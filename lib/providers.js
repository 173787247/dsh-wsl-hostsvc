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
  if (service?.id !== "vllm") return [];
  if (!service.open) {
    return [
      "vLLM :8000 closed from WSL — if you use Docker, run docker_doctor (focus=vllm), start Desktop/dockerd, then docker run --gpus all -p 8000:8000 vllm/vllm-openai …",
      "Native Windows vLLM is uncommon; prefer Docker on WSL or a known AI1/desktop stack.",
    ];
  }
  return [
    "vLLM on Windows native is uncommon; Docker on WSL or desktop AI1 stacks often listen on 8000.",
    "Confirm served model id (vLLM --model / OpenAI /v1/models) before pasting providerSnippets.",
    "Do not run vLLM + Ollama + llama-server on the same GPU without enough VRAM.",
    "Export VLLM_API_KEY=vllm before dsh web.",
    "Pair with docker_doctor when the port is open but responses fail (wrong container / GPU runtime).",
  ];
}

export async function fetchOllamaModelNames(baseURL, timeoutMs = 2500, fetchFn = fetch) {
  const root = String(baseURL).replace(/\/v1\/?$/, "");
  try {
    const res = await fetchFn(`${root}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m) => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

/** Extract num_ctx / context length from Ollama /api/show JSON. */
export function parseOllamaNumCtx(showJson) {
  if (!showJson || typeof showJson !== "object") return null;
  const params = String(showJson.parameters || "");
  const m = params.match(/\bnum_ctx\s+(\d+)/i);
  if (m) return Number(m[1]);
  const md = showJson.model_info || showJson.details || {};
  for (const [k, v] of Object.entries(md)) {
    if (/context_length|num_ctx/i.test(k) && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

export async function fetchOllamaShow(baseURL, model, { timeoutMs = 4000, fetchFn = fetch } = {}) {
  const root = String(baseURL).replace(/\/v1\/?$/, "");
  try {
    const res = await fetchFn(`${root}/api/show`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: model }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, model, numCtx: null, error: `http_${res.status}` };
    const data = await res.json();
    return { ok: true, model, numCtx: parseOllamaNumCtx(data), error: "", rawParameters: data.parameters || "" };
  } catch (err) {
    return {
      ok: false,
      model,
      numCtx: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Lightweight scrape of contextWindow values under llm-pi-ai models in settings.yaml.
 * Returns { modelId: contextWindow }.
 */
export function parseSettingsContextWindows(yamlText) {
  const text = String(yamlText || "");
  const out = {};
  let currentId = "";
  for (const line of text.split(/\r?\n/)) {
    const idM = line.match(/^\s+-\s+id:\s*(\S+)\s*$/);
    if (idM) {
      currentId = idM[1].replace(/['"]/g, "");
      continue;
    }
    const cwM = line.match(/^\s+contextWindow:\s*(\d+)\s*$/);
    if (cwM && currentId) {
      out[currentId] = Number(cwM[1]);
      currentId = "";
    }
  }
  return out;
}

export function compareCtx(settingsCw, ollamaNumCtx) {
  if (!Number.isFinite(settingsCw) || !Number.isFinite(ollamaNumCtx)) {
    return { ctxMatch: "unknown", settingsCw: settingsCw ?? null, ollamaNumCtx: ollamaNumCtx ?? null };
  }
  if (settingsCw > ollamaNumCtx) {
    return { ctxMatch: "mismatch", settingsCw, ollamaNumCtx };
  }
  return { ctxMatch: "ok", settingsCw, ollamaNumCtx };
}

export function buildCtxAdvice(ctxReports = []) {
  const tips = [];
  for (const r of ctxReports) {
    if (r.ctxMatch === "mismatch") {
      tips.push(
        `ctx mismatch for ${r.model}: settings contextWindow=${r.settingsCw} > Ollama num_ctx=${r.ollamaNumCtx}. Lower settings or raise OLLAMA_NUM_CTX / recreate the model.`,
      );
    } else if (r.ctxMatch === "ok") {
      tips.push(`ctx ok for ${r.model}: settings ${r.settingsCw} ≤ Ollama num_ctx ${r.ollamaNumCtx}.`);
    }
  }
  return tips;
}

export async function fetchOpenAiModels(baseURL, { timeoutMs = 3000, fetchFn = fetch } = {}) {
  const root = String(baseURL).replace(/\/$/, "");
  const url = root.endsWith("/v1") ? `${root}/models` : `${root}/v1/models`;
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, ids: [], error: `http_${res.status}`, url };
    const data = await res.json();
    const ids = (data.data || []).map((m) => m.id).filter(Boolean);
    return { ok: true, ids, error: "", url };
  } catch (err) {
    return {
      ok: false,
      ids: [],
      error: err instanceof Error ? err.message : String(err),
      url,
    };
  }
}

export function collectServiceHints(openServices, { ollamaModels = [], ctxReports = [], openAiNotes = [] } = {}) {
  const hints = [];
  for (const s of openServices) {
    hints.push(...buildOllamaHints(s, { models: s.id === "ollama" ? ollamaModels : [] }));
    hints.push(...buildUnslothHints(s));
    hints.push(...buildVllmHints(s));
  }
  hints.push(...buildCtxAdvice(ctxReports));
  hints.push(...openAiNotes);
  return [...new Set(hints)];
}
