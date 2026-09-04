import { createConnection } from "node:net";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { runPowerShell } from "./wsl-host.js";
import {
  CONNECTIVITY_PLAYBOOK,
  buildProviderSnippets,
  collectServiceHints,
  compareCtx,
  fetchOllamaModelNames,
  fetchOllamaShow,
  fetchOpenAiModels,
  parseSettingsContextWindows,
} from "./providers.js";

/** Well-known OpenAI-compatible local LLM ports on the Windows host. */
export const SERVICE_PORTS = {
  ollama: { port: 11434, label: "Ollama", path: "/v1" },
  lmstudio: { port: 1234, label: "LM Studio", path: "/v1" },
  vllm: { port: 8000, label: "vLLM", path: "/v1" },
  llama: { port: 8080, label: "llama-server / Unsloth Desktop", path: "/v1" },
};

export { CONNECTIVITY_PLAYBOOK, buildProviderSnippets };

export function notWsl() {
  return {
    ok: false,
    error: "not running in WSL",
    windowsHostIp: "",
    hostsTried: [],
    targets: [],
    services: [],
    suggestedBaseURL: "",
    providerSnippets: { yaml: "", blocks: [] },
    ollamaModels: [],
    ctxReports: [],
    openAiModels: [],
    settingsPath: "",
    connectivityPlaybook: CONNECTIVITY_PLAYBOOK,
    advice: ["Run host_reach inside WSL."],
  };
}

export function parameters() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      profile: {
        type: "string",
        enum: ["all", "ollama", "lmstudio", "vllm", "llama", "custom"],
        description:
          "Which local LLM ports to probe (default all). custom uses port= only.",
      },
      port: {
        type: "integer",
        description: "Single TCP port when profile=custom (or override one service).",
      },
      hosts: {
        type: "array",
        items: { type: "string" },
        description: "Hostnames/IPs to try (default: common WSL→Windows candidates).",
      },
      includeProviders: {
        type: "boolean",
        description: "Include paste-ready llm-pi-ai provider YAML (default true).",
      },
    },
  };
}

export function outputSchema() {
  return { type: "object", additionalProperties: true };
}

export function format(v) {
  const lines = [`host_reach ok=${v.ok}`];
  if (v.windowsHostIp) lines.push(`windowsHostIp: ${v.windowsHostIp}`);
  for (const s of v.services || []) {
    const status = s.open ? "OPEN" : "closed";
    const url = s.suggestedBaseURL ? ` → ${s.suggestedBaseURL}` : "";
    lines.push(`${s.id} (${s.label}) :${s.port} ${status}${url}`);
  }
  for (const t of v.targets || []) {
    lines.push(`  ${t.host}:${t.port} => ${t.open ? "open" : "closed"}${t.error ? " " + t.error : ""}`);
  }
  if (v.suggestedBaseURL) lines.push(`suggestedBaseURL: ${v.suggestedBaseURL}`);
  if (v.providerSnippets?.yaml) {
    lines.push("");
    lines.push("--- providerSnippets (paste into ~/.dsh/settings.yaml) ---");
    lines.push(v.providerSnippets.yaml);
  }
  if (v.ollamaModels?.length) lines.push(`ollamaModels: ${v.ollamaModels.join(", ")}`);
  if (v.ctxReports?.length) {
    lines.push("ctxReports:");
    for (const r of v.ctxReports) {
      lines.push(
        `  ${r.model}: match=${r.ctxMatch} settings=${r.settingsCw ?? "?"} ollama_num_ctx=${r.ollamaNumCtx ?? "?"}`,
      );
    }
  }
  if (v.openAiModels?.length) {
    for (const m of v.openAiModels) {
      const ready = m.apiReady ? "apiReady" : "apiNotReady";
      const detail = m.apiReady
        ? m.ids.join(", ") || "(empty)"
        : `${m.error || "fail"} http=${m.httpStatus ?? "?"}`;
      lines.push(`openAiModels(${m.service}): tcpOpen=${m.tcpOpen ?? "?"} ${ready} ${detail}`);
    }
  }
  for (const a of v.advice || []) lines.push(`- ${a}`);
  if (v.connectivityPlaybook?.length) {
    lines.push("");
    lines.push("connectivityPlaybook:");
    for (const step of v.connectivityPlaybook) lines.push(`  • ${step}`);
  }
  return lines.join("\n");
}

function probe(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    const done = (open, error = "") => {
      try {
        sock.destroy();
      } catch {
        /* ignore */
      }
      resolve({ host, port, open, error: error || "" });
    };
    sock.setTimeout(timeoutMs);
    sock.on("connect", () => done(true, ""));
    sock.on("timeout", () => done(false, "timeout"));
    sock.on("error", (err) => done(false, err.message || "error"));
  });
}

/** Deep-replace undefined with null so dsh lossless JSON accepts the tool result. */
export function toLossless(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(toLossless);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = toLossless(v);
  }
  return out;
}

async function windowsHostIp() {
  try {
    const resolv = readFileSync("/etc/resolv.conf", "utf8");
    const m = resolv.match(/^nameserver\s+(\S+)/m);
    if (m) return m[1];
  } catch {
    /* ignore */
  }
  try {
    const { stdout } = await runPowerShell(
      "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' } | Select-Object -First 1 -ExpandProperty IPAddress)",
      { timeoutMs: 10_000 },
    );
    const ip = stdout
      .trim()
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find(Boolean);
    if (ip) return ip;
  } catch {
    /* ignore */
  }
  return "";
}

function resolvePorts(args) {
  const profile = typeof args?.profile === "string" ? args.profile : "all";

  if (profile === "custom" || (args?.profile == null && Number.isInteger(args?.port))) {
    const port = Number.isInteger(args?.port) ? args.port : 11434;
    return [{ id: "custom", label: `port ${port}`, port, path: "/v1" }];
  }
  if (profile !== "all" && SERVICE_PORTS[profile]) {
    const s = SERVICE_PORTS[profile];
    return [{ id: profile, ...s }];
  }
  return Object.entries(SERVICE_PORTS).map(([id, s]) => ({ id, ...s }));
}

export async function execute(args) {
  const includeProviders = args?.includeProviders !== false;
  const servicesSpec = resolvePorts(args);
  const winIp = await windowsHostIp();
  const defaults = ["127.0.0.1", "localhost", "host.docker.internal", winIp].filter(Boolean);
  const hosts = Array.isArray(args?.hosts) && args.hosts.length
    ? args.hosts.map(String)
    : [...new Set(defaults)];

  const targets = [];
  const services = [];
  for (const spec of servicesSpec) {
    let hit = null;
    for (const host of hosts) {
      const t = await probe(host, spec.port);
      targets.push({ ...t, service: spec.id });
      if (t.open && !hit) hit = t;
    }
    services.push({
      id: spec.id,
      label: spec.label,
      port: spec.port,
      open: Boolean(hit),
      host: hit?.host || "",
      suggestedBaseURL: hit ? `http://${hit.host}:${spec.port}${spec.path}` : "",
    });
  }

  const openServices = services.filter((s) => s.open);
  const primary = openServices[0];

  let ollamaModels = [];
  const ollamaSvc = openServices.find((s) => s.id === "ollama");
  if (ollamaSvc?.suggestedBaseURL) {
    ollamaModels = await fetchOllamaModelNames(ollamaSvc.suggestedBaseURL);
  }

  let settingsMap = {};
  const settingsPath = join(homedir(), ".dsh", "settings.yaml");
  try {
    if (existsSync(settingsPath)) {
      settingsMap = parseSettingsContextWindows(readFileSync(settingsPath, "utf8"));
    }
  } catch {
    settingsMap = {};
  }

  const ctxReports = [];
  if (ollamaSvc?.suggestedBaseURL && ollamaModels.length) {
    const probeModels = ollamaModels.slice(0, 3);
    for (const model of probeModels) {
      const show = await fetchOllamaShow(ollamaSvc.suggestedBaseURL, model);
      const settingsCw = settingsMap[model] ?? null;
      const cmp = compareCtx(settingsCw, show.numCtx);
      ctxReports.push({
        model,
        ...cmp,
        showOk: show.ok,
        showError: show.error || "",
      });
    }
  }

  const openAiModels = [];
  const openAiNotes = [];
  for (const s of openServices.filter((x) => x.id === "vllm" || x.id === "llama" || x.id === "lmstudio")) {
    if (!s.suggestedBaseURL) continue;
    const models = await fetchOpenAiModels(s.suggestedBaseURL);
    openAiModels.push({ service: s.id, ...models });
    if (models.apiReady && models.ids.length) {
      openAiNotes.push(
        `${s.id} /v1/models ok (${models.ids.slice(0, 5).join(", ")}). Use these ids in providerSnippets.`,
      );
    } else if (models.tcpOpen && !models.apiReady) {
      const statusHint =
        models.httpStatus === 404
          ? "HTTP 404 — port open but not an OpenAI /v1 service (wrong process or path); run docker_doctor / check who owns the port."
          : `API not ready (${models.error || `http_${models.httpStatus}`}); port open ≠ models API — try docker_doctor.`;
      openAiNotes.push(`${s.id}: ${statusHint}`);
    } else if (!models.ok) {
      openAiNotes.push(`${s.id} /v1/models failed (${models.error}) — TCP may be closed; re-probe or docker_doctor.`);
    }
  }

  const providerSnippets = includeProviders
    ? buildProviderSnippets(openServices.filter((s) => s.id !== "custom"))
    : { yaml: "", blocks: [] };

  const advice = [
    "Point llm-pi-ai providers.*.baseURL at a suggestedBaseURL below (keep the /v1 suffix).",
    "If only the Windows host IP works: set OLLAMA_HOST=0.0.0.0:11434 (or the app's 'listen on all interfaces') then re-probe.",
    "WSL mirrored networking may make 127.0.0.1 reach Windows; classic NAT often needs the resolv.conf nameserver IP.",
    "Do not run Ollama + vLLM + llama-server on the same GPU at once unless you know VRAM headroom.",
    "See examples/local-llm-providers.settings.yaml in this repo for full snippets.",
    ...collectServiceHints(openServices, { ollamaModels, ctxReports, openAiNotes }),
  ];
  if (!openServices.length) {
    advice.unshift("No probed local LLM port is reachable from WSL yet.");
  }
  if (!Object.keys(settingsMap).length) {
    advice.push(`No contextWindow entries parsed from ${settingsPath} (missing file or no model ids yet).`);
  }

  return toLossless({
    ok: openServices.length > 0,
    error: "",
    windowsHostIp: winIp || "",
    hostsTried: hosts,
    services,
    targets,
    suggestedBaseURL: primary?.suggestedBaseURL || "",
    providerSnippets,
    ollamaModels,
    ctxReports,
    openAiModels,
    settingsPath,
    connectivityPlaybook: CONNECTIVITY_PLAYBOOK,
    advice,
  });
}
