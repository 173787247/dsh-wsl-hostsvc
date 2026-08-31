# dsh-wsl-hostsvc

DeepSeek Harness 插件：在 **WSL** 里探测 **Windows 主机**上的 OpenAI 兼容本地 LLM，并给出可达的 `baseURL`。

配套 **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**。

[English → README.md](./README.md)

## 做什么

工具 **`host_reach`**（默认 `profile=all`）会扫：

| id | 端口 | 常见服务 |
|----|------|----------|
| `ollama` | 11434 | Ollama |
| `lmstudio` | 1234 | LM Studio 本地服务 |
| `vllm` | 8000 | vLLM OpenAI 服务 |
| `llama` | 8080 | llama-server / Unsloth Desktop |

探测主机：`127.0.0.1`、`localhost`、`host.docker.internal`，以及 `/etc/resolv.conf` 里的 Windows IP。

把返回的 `suggestedBaseURL` 写进 `~/.dsh/settings.yaml` 的 `llm-pi-ai.providers.*.baseURL`（保留 `/v1`）。模板见 [`examples/local-llm-providers.settings.yaml`](./examples/local-llm-providers.settings.yaml)。

## 安装

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-hostsvc
```

重启 `dsh web` 并开**新**会话。

## 用法

让 agent 跑 `host_reach`；可用 `profile: ollama|lmstudio|vllm|llama|all`，或 `port` 扫自定义端口。

若全是 closed：在 Windows 让服务监听 `0.0.0.0`（如 `OLLAMA_HOST=0.0.0.0:11434`），或开 WSL mirrored networking，再测一次。

## 许可

MIT
