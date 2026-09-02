/** Provider metadata and paste-ready YAML for ~/.dsh/settings.yaml */
export const PROVIDER_META = {
  ollama: {
    displayName: "Local Ollama (Windows)",
    apiKeyEnv: "OLLAMA_API_KEY",
    dummyKey: "ollama",
    defaultModel: "REPLACE_WITH_ollama_list_NAME",
    contextWindow: 8192,
    maxTokens: 8192,
  },
  lmstudio: {
    displayName: "LM Studio (Windows)",
    apiKeyEnv: "LMSTUDIO_API_KEY",
    dummyKey: "lmstudio",
    defaultModel: "REPLACE_WITH_LMSTUDIO_MODEL_ID",
    contextWindow: 32768,
    maxTokens: 8192,
  },
  vllm: {
    displayName: "vLLM (Docker / WSL)",
    apiKeyEnv: "VLLM_API_KEY",
    dummyKey: "vllm",
    defaultModel: "REPLACE_WITH_VLLM_SERVED_MODEL",
    contextWindow: 131072,
    maxTokens: 8192,
  },
  llama: {
    displayName: "llama-server / Unsloth Desktop",
    apiKeyEnv: "LLAMA_API_KEY",
    dummyKey: "llama",
    defaultModel: "REPLACE_WITH_LLAMA_SERVER_MODEL",
    contextWindow: 131072,
    maxTokens: 8192,
  },
};

export const CONNECTIVITY_PLAYBOOK = [
  "Local LLM unreachable from WSL → run host_reach (profile=all); paste providerSnippets into ~/.dsh/settings.yaml.",
  "DeepSeek / npm HTTPS fails → net_doctor (target=all); set NODE_USE_ENV_PROXY=1 and Windows proxy port.",
  "DNS oddities (ModelScope/GitHub resolve wrong) → wsl_dns doctor.",
  "Clock skew breaks TLS → wsl_clock doctor.",
  "Only Windows host IP works for Ollama → set OLLAMA_HOST=0.0.0.0:11434 on Windows, or enable mirrored networking in .wslconfig.",
  "Need LAN access to dsh web → wsl_expose advise then apply (admin on Windows).",
];

export function buildProviderBlock(id, baseURL, meta = PROVIDER_META[id]) {
  if (!meta || !baseURL) return null;
  return {
    id,
    baseURL,
    apiKeyEnv: meta.apiKeyEnv,
    displayName: meta.displayName,
    yaml: [
      `    ${id}:`,
      `      displayName: ${meta.displayName}`,
      `      apiKeyEnv: ${meta.apiKeyEnv}`,
      `      api: openai-completions`,
      `      baseURL: ${baseURL}`,
      `      compat:`,
      `        supportsDeveloperRole: false`,
      `        maxTokensField: max_tokens`,
      `      models:`,
      `        - id: ${meta.defaultModel}`,
      `          name: ${meta.displayName}`,
      `          contextWindow: ${meta.contextWindow}`,
      `          maxTokens: ${meta.maxTokens}`,
    ].join("\n"),
  };
}

export function buildProviderSnippets(openServices) {
  const blocks = [];
  for (const s of openServices) {
    const block = buildProviderBlock(s.id, s.suggestedBaseURL);
    if (block) blocks.push(block);
  }
  if (!blocks.length) {
    return {
      yaml: "# No reachable local LLM port — run host_reach after starting Ollama/LM Studio/vLLM/Unsloth.",
      blocks: [],
    };
  }
  const yaml = [
    "# Paste under llm-pi-ai.providers in ~/.dsh/settings.yaml",
    "# Export dummy keys before dsh web, e.g. export OLLAMA_API_KEY=ollama",
    "llm-pi-ai:",
    "  providers:",
    ...blocks.map((b) => b.yaml),
  ].join("\n");
  return { yaml, blocks };
}

export function buildOllamaHints(service, { models = [] } = {}) {
  if (!service?.open || service.id !== "ollama") return [];
  const hints = [
    "Ollama contextWindow in settings.yaml must not exceed the model's real n_ctx. Mismatch causes 400 errors (e.g. settings 131072 but Ollama n_ctx=8192).",
    "Fix: set OLLAMA_NUM_CTX=8192 (or your target) in Windows before starting Ollama, or lower contextWindow/maxTokens in settings.yaml to match `ollama show <model>`.",
    "If 127.0.0.1:11434 fails from WSL but the Windows host IP works: set OLLAMA_HOST=0.0.0.0:11434 (Windows env or systemd) and restart Ollama.",
    "Export OLLAMA_API_KEY=ollama (any non-empty string) before starting dsh web when using the ollama provider.",
  ];
  if (models.length) {
    hints.push(`Ollama models seen: ${models.slice(0, 5).join(", ")}${models.length > 5 ? " …" : ""}. Use exact names in settings.yaml.`);
  }
  return hints;
}

export function buildUnslothHints(service) {
  if (!service?.open || service.id !== "llama") return [];
  return [
    "Port 8080 is common for Unsloth Desktop / llama-server — confirm in the Unsloth UI (Studio backend may differ).",
    "Unsloth Studio (~/.unsloth/studio) is not Unsloth Desktop (winget). Desktop exposes OpenAI-compatible /v1 on a configurable port.",
    "Flash-Next multi-shard GGUF may need Unsloth Desktop or a patched llama.cpp; plain Ollama cannot load all shard layouts.",
    "Export LLAMA_API_KEY=llama before dsh web when using the llama provider block.",
  ];
}

export function buildVllmHints(service) {
  if (!service?.open || service.id !== "vllm") return [];
  return [
    "vLLM on Windows native is uncommon; Docker on WSL or desktop AI1 stacks often listen on 8000.",
    "Do not run vLLM + Ollama + llama-server on the same GPU without enough VRAM.",
    "Export VLLM_API_KEY=vllm before dsh web.",
  ];
}

export async function fetchOllamaModelNames(baseURL, timeoutMs = 2500) {
  const root = String(baseURL).replace(/\/v1\/?$/, "");
  try {
    const res = await fetch(`${root}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m) => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

export function collectServiceHints(openServices, { ollamaModels = [] } = {}) {
  const hints = [];
  for (const s of openServices) {
    hints.push(...buildOllamaHints(s, { models: s.id === "ollama" ? ollamaModels : [] }));
    hints.push(...buildUnslothHints(s));
    hints.push(...buildVllmHints(s));
  }
  return [...new Set(hints)];
}
