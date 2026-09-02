import { detectWsl } from "./lib/wsl-host.js";
import * as core from "./lib/hostsvc.js";

export const name = "dsh-wsl-hostsvc";
export const inject = ["tools", "systemPrompt"];

export function apply(ctx, config = {}) {
  const timeoutMs = positive(config.timeoutMs, 15_000);
  const wsl = detectWsl();

  ctx.systemPrompt.section({
    name: "tool:host_reach",
    order: 114,
    text: "Use host_reach to probe Windows-host local LLMs from WSL (Ollama 11434, LM Studio 1234, vLLM 8000, llama-server 8080). Paste providerSnippets into ~/.dsh/settings.yaml under llm-pi-ai.providers; keep contextWindow ≤ Ollama n_ctx. Follow connectivityPlaybook when HTTPS or DNS also fails.",
  });

  ctx.tools.register({
    name: "host_reach",
    description: "Probe Windows-host Ollama / LM Studio / vLLM / llama-server from WSL; suggest OpenAI-compatible baseURL.",
    parameters: core.parameters(config),
    output: {
      schema: core.outputSchema(),
      render: (_args, value) => [{ type: "text", text: core.format(value) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      if (!wsl) return core.notWsl ? core.notWsl() : { ok: false, error: "not running in WSL" };
      return core.execute(args, config);
    },
    presentCall: () => ({ card: "generic", title: "host_reach" }),
    presentResult: (_args, result) => (
      result.isError
        ? { card: "generic", title: "host_reach failed", content: result.content }
        : { card: "generic", title: "host_reach", content: result.content }
    ),
  });
}

function positive(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
