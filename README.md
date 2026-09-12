# dsh-wsl-hostsvc

> **Install set:** part of [dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit). Prefer `KIT_SET=daily` | `llm` | `github` | `full` (see kit README). Fault tree: [TROUBLESHOOTING.md](https://github.com/173787247/dsh-wsl-kit/blob/master/docs/TROUBLESHOOTING.md).

DeepSeek Harness plugin: from **WSL**, probe **Windows-host** OpenAI-compatible LLM servers and suggest a reachable `baseURL`.

[中文说明 → README.zh.md](./README.zh.md)

## Compatibility

| Field | Value |
|-------|-------|
| **Plugin** | `dsh-wsl-hostsvc` **0.4.2** |
| **Minimum dsh** | ≥ **0.1.2** (web UI one-shot `?token=` on Windows relay `:3081`) |
| **Latest verified** | See [dsh-wsl-kit Compatibility](https://github.com/173787247/dsh-wsl-kit#compatibility-2026-09) (currently **`0.1.5-rc.1`**) — single source of truth for the suite |
| **Kit set** | `llm` / `full` (some also useful alone) |
| **Cloud Flash** | Use model id **`deepseek-flash`** (V4.1 Flash) in `~/.dsh/settings.yaml` / `llm-deepseek` — not configured by this plugin |
| **Agent Teams** | Upstream experimental; not required here |

Suite floor versions: kit [`check-plugin-versions.sh`](https://github.com/173787247/dsh-wsl-kit/blob/master/scripts/check-plugin-versions.sh). Fault tree: [TROUBLESHOOTING.md](https://github.com/173787247/dsh-wsl-kit/blob/master/docs/TROUBLESHOOTING.md).

**Scope:** local OpenAI-compatible servers on the Windows host (`host_reach`). Does not configure cloud DeepSeek; for V4.1 Flash set model id **`deepseek-flash`** in settings.

## What it does

Tool **`host_reach`** (default `profile=all`) probes:

| id | Port | Typical server |
|----|------|----------------|
| `ollama` | 11434 | Ollama |
| `lmstudio` | 1234 | LM Studio local server |
| `vllm` | 8000 | vLLM OpenAI server |
| `llama` | 8080 | llama-server / Unsloth Desktop |

Hosts tried: `127.0.0.1`, `localhost`, `host.docker.internal`, and the Windows IP from `/etc/resolv.conf`.

### Outputs worth pasting

- **`suggestedBaseURL`** / per-service URLs → `llm-pi-ai.providers.*.baseURL` (keep `/v1`)
- **`providerSnippets.yaml`** → paste under `llm-pi-ai.providers` in `~/.dsh/settings.yaml`
- **`ollamaModels`** → exact ids from `ollama list` / `/api/tags`
- **`connectivityPlaybook`** → ordered tools when HTTPS/DNS also fail
- **hints** → Ollama `n_ctx` vs settings `contextWindow`, Unsloth Desktop vs Studio, VRAM

Template: [`examples/local-llm-providers.settings.yaml`](./examples/local-llm-providers.settings.yaml).

## Ollama context (common 400)

Plugin-heavy dsh prompts often need **>8k** tokens even for a short chat turn. This is independent of cloud **`deepseek-flash`** (V4.1 Flash), which you configure under official `llm-deepseek` / default model — not via `host_reach`.

1. Set Ollama `PARAMETER num_ctx 32768` (Modelfile / recreate model), **or** `OLLAMA_NUM_CTX` on Windows before starting Ollama.
2. Match `contextWindow` in settings to that `num_ctx` (not the model's theoretical max like 131072 unless Ollama actually runs it).
3. Keep `maxTokens` smaller than `contextWindow` (e.g. 4096) so the prompt still fits.

Mismatch examples:

- settings `131072` + Ollama `n_ctx=8192` → API errors
- settings/Ollama both `8192` + fat system/tools prompt (~10k) → `CONTEXT_WINDOW_EXCEEDED`

## Unsloth / Flash-Next

- **Unsloth Desktop** (winget) ≠ **Unsloth Studio** (`~/.unsloth/studio`). Desktop often exposes OpenAI `/v1` on **8080** (`llama` profile).
- Multi-shard **Flash-Next** GGUF may need Desktop or a patched llama.cpp; plain Ollama cannot load every shard layout.
- Do not co-load Ollama + vLLM + llama-server on one 16GB GPU without headroom.

## Install

```sh
# Recommended with the LLM set:
curl -fsSL https://raw.githubusercontent.com/173787247/dsh-wsl-kit/master/install.sh | KIT_SET=llm bash

# Or alone:
dsh plugin --profile web add github:173787247/dsh-wsl-hostsvc
```

Restart `dsh web` and open a **new** session.

WSL UI from Windows browser: use kit `scripts/restart-dsh-web.sh` and open **http://127.0.0.1:3081/** (relay; dsh itself binds `127.0.0.1:3080` only).

## Usage

Ask the agent to run `host_reach` (`profile: ollama|lmstudio|vllm|llama|all`, optional `port`, `includeProviders`).

If nothing opens: on Windows bind beyond loopback (e.g. `OLLAMA_HOST=0.0.0.0:11434`) or enable WSL mirrored networking, then re-probe.

## License

MIT
