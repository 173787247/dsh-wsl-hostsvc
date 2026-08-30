import { detectWsl } from "./lib/wsl-host.js";
import {
  buildHostReachAdvice,
  candidateBases,
  formatHostReachReport,
  probeCandidate,
  readMirroredHint,
  readResolvNameserver,
} from "./lib/hostsvc.js";

export const name = "dsh-wsl-hostsvc";
export const inject = ["tools", "systemPrompt"];

export function apply(ctx, config = {}) {
  const timeoutMs = positive(config.timeoutMs, 8_000);
  const defaultPorts = Array.isArray(config.defaultPorts) && config.defaultPorts.length
    ? config.defaultPorts.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [11434];
  const paths = config.paths && typeof config.paths === "object" ? config.paths : {};
  const wsl = detectWsl();

  ctx.systemPrompt.section({
    name: "tool:host_reach",
    order: 122,
    text: [
      "Use host_reach when the agent in WSL cannot reach a Windows-host service (Ollama on 11434, or another openai-compatible server).",
      "It probes 127.0.0.1, localhost, the resolv.conf nameserver, and mirrored-networking hints, then advises a working baseURL for DSH settings.yaml.",
    ].join(" "),
  });

  ctx.tools.register({
    name: "host_reach",
    description:
      "Probe Windows-host services from WSL (Ollama 11434 or custom host:port); return working baseURL and settings advice.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        port: {
          type: "integer",
          description: `TCP port to probe (default first of ${defaultPorts.join(",")}).`,
        },
        ports: {
          type: "array",
          items: { type: "integer" },
          description: "Optional list of ports to probe instead of config.defaultPorts.",
        },
        path: {
          type: "string",
          description: "Optional HTTP path to GET (default /api/tags for port 11434).",
        },
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          wsl: { type: "boolean" },
          nameserver: { type: "string" },
          mirrored: { type: "string" },
          probes: { type: "array", items: { type: "object", additionalProperties: true } },
          working: { type: "array", items: { type: "string" } },
          advice: { type: "array", items: { type: "string" } },
          error: { type: "string" },
        },
      },
      render: (_args, value) => [{ type: "text", text: formatHostReachReport(value) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      if (!wsl) {
        return { wsl: false, error: "not running in WSL", probes: [], advice: [], working: [] };
      }
      const nameserver = readResolvNameserver();
      const mirrored = readMirroredHint();
      const bases = candidateBases({ nameserver, mirrored });
      const ports = Array.isArray(args?.ports) && args.ports.length
        ? args.ports.map(Number)
        : Number.isInteger(args?.port)
          ? [args.port]
          : defaultPorts;
      const perProbeTimeout = Math.min(2_000, Math.floor(timeoutMs / Math.max(1, bases.length * ports.length)));
      const probes = [];
      for (const port of ports) {
        const path = typeof args?.path === "string"
          ? args.path
          : (paths[String(port)] || null);
        for (const base of bases) {
          probes.push(await probeCandidate(base, port, { timeoutMs: perProbeTimeout, path }));
        }
      }
      const report = {
        wsl: true,
        nameserver: nameserver || undefined,
        mirrored: mirrored || undefined,
        probes,
        working: probes.filter((p) => p.ok).map((p) => p.baseURL),
      };
      report.advice = buildHostReachAdvice(report);
      return report;
    },
    presentCall: () => ({ card: "generic", title: "Host reach" }),
    presentResult: (_args, result) => (
      result.isError
        ? { card: "generic", title: "Host reach failed", content: result.content }
        : { card: "generic", title: "Host reach", content: result.content }
    ),
  });
}

function positive(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
