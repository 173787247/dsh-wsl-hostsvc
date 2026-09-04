# Changelog

## 0.4.2

- `fetchOpenAiModels` / `openAiModels[]`: `tcpOpen`, `apiReady`, `httpStatus` (404 → apiReady false + docker_doctor advice).

## 0.4.1

- Fix `value is not lossless JSON`: probe `error` always a string; sanitize tool output with `toLossless` (no `undefined`).

## 0.4.0

- Probe Ollama `/api/show` for real `num_ctx` and compare to `~/.dsh/settings.yaml` `contextWindow` (`ctxReports` / `ctxMatch`).
- For open vLLM / LM Studio / llama ports, light `GET /v1/models` and note ids in advice.
- Pure helpers: `parseOllamaNumCtx`, `parseSettingsContextWindows`, `compareCtx`, `fetchOpenAiModels`.

## 0.3.1

- Provider snippets and service-specific hints (Unsloth / vLLM / Ollama ctx).

## 0.1.0

- Initial public release of `dsh-wsl-hostsvc` for DeepSeek Harness on Windows + WSL.
