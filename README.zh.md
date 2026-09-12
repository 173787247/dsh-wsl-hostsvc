# dsh-wsl-hostsvc

> **套件安装：** 见 [dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)。推荐 `KIT_SET=daily` | `llm` | `github` | `full`。故障树：[TROUBLESHOOTING.zh.md](https://github.com/173787247/dsh-wsl-kit/blob/master/docs/TROUBLESHOOTING.zh.md)。

DeepSeek Harness 插件：在 **WSL** 里探测 **Windows 主机**上的 OpenAI 兼容本地 LLM，并给出可达的 `baseURL`。

[English → README.md](./README.md)

## 兼容性

| 项 | 值 |
|----|----|
| **插件** | `dsh-wsl-hostsvc` **0.4.2** |
| **最低 dsh** | ≥ **0.1.2**（Windows 中继 `:3081` 一次性 `?token=`） |
| **最新验证** | 以 [dsh-wsl-kit 兼容性](https://github.com/173787247/dsh-wsl-kit#compatibility-2026-09) 为准（当前 **`0.1.5-rc.1`**）— 套件唯一真源 |
| **套件档位** | `llm` / `full`（也可单独装） |
| **云端 Flash** | settings / `llm-deepseek` 使用 **`deepseek-flash`**（V4.1 Flash）；本插件不配置模型 id |
| **Agent Teams** | 上游实验包；本插件不依赖 |

套件版本地板：[`check-plugin-versions.sh`](https://github.com/173787247/dsh-wsl-kit/blob/master/scripts/check-plugin-versions.sh)。故障树：[TROUBLESHOOTING.zh.md](https://github.com/173787247/dsh-wsl-kit/blob/master/docs/TROUBLESHOOTING.zh.md)。

**范围：** 探测 Windows 主机上的本地 OpenAI 兼容服务（`host_reach`）。不管云端 DeepSeek；V4.1 Flash 请在 settings 使用模型 id **`deepseek-flash`**。

## 做什么

工具 **`host_reach`**（默认 `profile=all`）会扫：

| id | 端口 | 常见服务 |
|----|------|----------|
| `ollama` | 11434 | Ollama |
| `lmstudio` | 1234 | LM Studio |
| `vllm` | 8000 | vLLM |
| `llama` | 8080 | llama-server / Unsloth Desktop |

探测主机：`127.0.0.1`、`localhost`、`host.docker.internal`，以及 `/etc/resolv.conf` 里的 Windows IP。

### 值得粘贴的字段

- **`suggestedBaseURL`** → `settings.yaml` 的 `baseURL`（保留 `/v1`）
- **`providerSnippets.yaml`** → 整段贴进 `llm-pi-ai.providers`
- **`ollamaModels`** → 与 `ollama list` 一致的模型名
- **`connectivityPlaybook`** → HTTPS/DNS 也坏时的工具顺序
- **hints** → Ollama `n_ctx`、Unsloth Desktop≠Studio、显存

模板：[`examples/local-llm-providers.settings.yaml`](./examples/local-llm-providers.settings.yaml)。

## Ollama 上下文（常见 400）

插件多时，系统提示 + 工具 schema 很容易 **>8k tokens**。这与云端 **`deepseek-flash`**（V4.1 Flash）无关——后者在官方 `llm-deepseek` / 默认模型里配，不经 `host_reach`。

1. Ollama 设 `PARAMETER num_ctx 32768`（或 Windows 启动前 `OLLAMA_NUM_CTX`）
2. settings 的 `contextWindow` **对齐** 实际 `n_ctx`（不要写 131072 而 Ollama 仍是 8192）
3. `maxTokens` 小于窗口（如 4096），给 prompt 留空

## Unsloth / Flash-Next

- Desktop（winget）≠ Studio；Desktop 常在 **:8080** 提供 `/v1`
- Flash-Next 多分片 GGUF：优先 Desktop / 带补丁的 llama.cpp；普通 Ollama 不一定能加载
- 同一张 16GB 卡上不要同时硬开 Ollama + vLLM + llama-server

## 安装

```sh
curl -fsSL https://raw.githubusercontent.com/173787247/dsh-wsl-kit/master/install.sh | KIT_SET=llm bash
# 或单独：
dsh plugin --profile web add github:173787247/dsh-wsl-hostsvc
```

重启 `dsh web`，开**新**会话。

Windows 浏览器访问 WSL 里的 UI：跑 kit 的 `scripts/restart-dsh-web.sh`，打开 **http://127.0.0.1:3081/**（中继；dsh 只绑 `127.0.0.1:3080`）。

## 用法

让 agent 跑 `host_reach`；可用 `profile` / `port` / `includeProviders`。

全 closed：Windows 侧 `OLLAMA_HOST=0.0.0.0:11434` 或开 mirrored networking 后再测。

## 许可

MIT
