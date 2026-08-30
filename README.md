# dsh-wsl-hostsvc

DeepSeek Harness tool: **`host_reach`** — DeepSeek Harness tool: probe Windows-host services (Ollama, custom ports) from WSL.

Part of **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**.

[中文说明 → README.zh.md](./README.zh.md)

---

## Why

Ollama and other openai-compatible servers often listen on the **Windows** host. From WSL, `localhost` may or may not reach them depending on NAT vs mirrored networking. This tool probes common bases and returns a working `baseURL` for DSH `settings.yaml`.

## Install

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-hostsvc
```

Restart `dsh web`. New session → Tools should list `host_reach`.

## Config

```yaml
- id: dsh-wsl-hostsvc
  name: dsh-wsl-hostsvc
  config:
        timeoutMs: 8000
        defaultPorts: [11434]
```

| Key | Default | Meaning |
|-----|---------|---------|
| `timeoutMs` | `8000` | Overall tool timeout |
| `defaultPorts` | `[11434]` | Ports to probe (Ollama default) |
| `paths` | — | Optional map of port → HTTP path |

## Test

```sh
npm test
```

## License

MIT
