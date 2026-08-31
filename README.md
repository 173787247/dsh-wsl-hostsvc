# dsh-wsl-hostsvc

DeepSeek Harness plugin: Probe Windows-host local services from WSL and suggest a reachable baseURL.

Part of **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**.

[中文说明 → README.zh.md](./README.zh.md)

## Install

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-hostsvc
# or local:
dsh plugin --profile web add /absolute/path/to/dsh-wsl-hostsvc
```

Restart `dsh web` and open a **new** session. Tool: `host_reach`.

## License

MIT
