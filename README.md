# dsh-wsl-hostsvc

DeepSeek Harness plugin: from **WSL**, probe **Windows-host** OpenAI-compatible LLM servers and suggest a reachable `baseURL`.

Part of **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**.

[中文说明 → README.zh.md](./README.zh.md)

## What it does

Tool **`host_reach`** (default `profile=all`) probes:

| id | Port | Typical server |
|----|------|----------------|
| `ollama` | 11434 | Ollama |
| `lmstudio` | 1234 | LM Studio local server |
| `vllm` | 8000 | vLLM OpenAI server |
| `llama` | 8080 | llama-server / Unsloth Desktop |

Hosts tried: `127.0.0.1`, `localhost`, `host.docker.internal`, and the Windows IP from `/etc/resolv.conf`.

Copy a `suggestedBaseURL` into `~/.dsh/settings.yaml` under `llm-pi-ai.providers.*.baseURL` (keep `/v1`). Snippets: [`examples/local-llm-providers.settings.yaml`](./examples/local-llm-providers.settings.yaml).

## Install

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-hostsvc
```

Restart `dsh web` and open a **new** session.

## Usage

Ask the agent to run `host_reach`, or call with `profile: ollama|lmstudio|vllm|llama|all` / `port` for a custom port.

If nothing opens: on Windows bind beyond loopback (e.g. `OLLAMA_HOST=0.0.0.0:11434`) or enable WSL mirrored networking, then re-probe.

## License

MIT
