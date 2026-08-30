# 

DeepSeek Harness 工具：**${tool}** — 

DeepSeek Harness 工具：**`host_reach`** — 从 WSL 探测 Windows 主机上的服务（Ollama / 自定义端口）。

属于 **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**。

[English → README.md](./README.md)

---

## 为什么需要

Ollama 等 openai-compatible 服务常跑在 **Windows** 主机上。WSL 里 `localhost` 能否连通取决于 NAT / mirrored 网络。本工具探测常见 base，并返回可用于 DSH `settings.yaml` 的可用 `baseURL`。

## 安装

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-hostsvc
```

重启 `dsh web`。新会话 → Tools 应出现 `host_reach`。

## 配置

```yaml
- id: dsh-wsl-hostsvc
  name: dsh-wsl-hostsvc
  config:
        timeoutMs: 8000
        defaultPorts: [11434]
```

| 键 | 默认 | 含义 |
|----|------|------|
| `timeoutMs` | `8000` | 工具总超时 |
| `defaultPorts` | `[11434]` | 探测端口（Ollama 默认） |
| `paths` | — | 可选：端口 → HTTP 路径 |

## 测试

```sh
npm test
```

## 许可

MIT
