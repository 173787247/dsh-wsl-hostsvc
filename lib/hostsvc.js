import { createConnection } from "node:net";
import { readFileSync } from "node:fs";
import { runPowerShell } from "./wsl-host.js";

export function notWsl() {
  return { ok: false, error: "not running in WSL", targets: [] };
}

export function parameters() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      port: { type: "integer", description: "TCP port on the Windows host (default 11434 for Ollama)." },
      hosts: {
        type: "array",
        items: { type: "string" },
        description: "Hostnames/IPs to try (default: common WSL→Windows candidates).",
      },
    },
  };
}

export function outputSchema() {
  return { type: "object", additionalProperties: true };
}

export function format(v) {
  const lines = [`host_reach ok=${v.ok}`];
  for (const t of v.targets || []) lines.push(`${t.host}:${t.port} => ${t.open ? "open" : "closed"}${t.error ? " " + t.error : ""}`);
  if (v.suggestedBaseURL) lines.push(`suggestedBaseURL: ${v.suggestedBaseURL}`);
  for (const a of v.advice || []) lines.push(`- ${a}`);
  return lines.join("\n");
}

function probe(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    const done = (open, error) => {
      try { sock.destroy(); } catch {}
      resolve({ host, port, open, error });
    };
    sock.setTimeout(timeoutMs);
    sock.on("connect", () => done(true));
    sock.on("timeout", () => done(false, "timeout"));
    sock.on("error", (err) => done(false, err.message));
  });
}

async function windowsHostIp() {
  try {
    const resolv = readFileSync("/etc/resolv.conf", "utf8");
    const m = resolv.match(/^nameserver\s+(\S+)/m);
    if (m) return m[1];
  } catch {}
  try {
    const { stdout } = await runPowerShell("(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' } | Select-Object -First 1 -ExpandProperty IPAddress)", { timeoutMs: 10_000 });
    const ip = stdout.trim().split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (ip) return ip;
  } catch {}
  return "";
}

export async function execute(args) {
  const port = Number.isInteger(args?.port) ? args.port : 11434;
  const winIp = await windowsHostIp();
  const defaults = ["127.0.0.1", "localhost", "host.docker.internal", winIp].filter(Boolean);
  const hosts = Array.isArray(args?.hosts) && args.hosts.length ? args.hosts.map(String) : [...new Set(defaults)];
  const targets = [];
  for (const host of hosts) targets.push(await probe(host, port));
  const hit = targets.find((t) => t.open);
  const advice = [
    "If only the Windows host IP works, point DSH/Ollama baseURL at http://<host-ip>:port/v1 (not WSL localhost).",
    "WSL mirrored networking may make 127.0.0.1 work; classic NAT often needs the resolv.conf nameserver IP.",
  ];
  return {
    ok: Boolean(hit),
    port,
    windowsHostIp: winIp,
    targets,
    suggestedBaseURL: hit ? `http://${hit.host}:${port}/v1` : "",
    advice,
  };
}
