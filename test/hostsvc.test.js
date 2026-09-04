import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOllamaHints,
  buildProviderSnippets,
  buildUnslothHints,
  buildVllmHints,
  compareCtx,
  CONNECTIVITY_PLAYBOOK,
  parseOllamaNumCtx,
  parseSettingsContextWindows,
} from "../lib/providers.js";
import { format, parameters, SERVICE_PORTS } from "../lib/hostsvc.js";

describe("host_reach", () => {
  it("formats multi-service results with provider snippets", () => {
    const snippets = buildProviderSnippets([
      {
        id: "ollama",
        label: "Ollama",
        port: 11434,
        open: true,
        suggestedBaseURL: "http://172.28.0.1:11434/v1",
      },
    ]);
    const text = format({
      ok: true,
      windowsHostIp: "172.28.0.1",
      services: [
        {
          id: "ollama",
          label: "Ollama",
          port: 11434,
          open: true,
          suggestedBaseURL: "http://172.28.0.1:11434/v1",
        },
      ],
      targets: [{ host: "172.28.0.1", port: 11434, open: true }],
      suggestedBaseURL: "http://172.28.0.1:11434/v1",
      providerSnippets: snippets,
      connectivityPlaybook: CONNECTIVITY_PLAYBOOK,
      advice: ["ok"],
    });
    assert.match(text, /ollama/i);
    assert.match(text, /11434/);
    assert.match(text, /providerSnippets/);
    assert.match(text, /connectivityPlaybook/);
  });

  it("declares known service ports", () => {
    assert.equal(SERVICE_PORTS.ollama.port, 11434);
    assert.equal(SERVICE_PORTS.lmstudio.port, 1234);
    assert.equal(SERVICE_PORTS.vllm.port, 8000);
    assert.equal(SERVICE_PORTS.llama.port, 8080);
  });

  it("exposes profile and includeProviders parameters", () => {
    const p = parameters();
    assert.ok(p.properties.profile);
    assert.ok(p.properties.includeProviders);
    assert.ok(p.properties.profile.enum.includes("all"));
  });
});

describe("providers", () => {
  it("builds paste-ready yaml for open services", () => {
    const { yaml, blocks } = buildProviderSnippets([
      { id: "ollama", suggestedBaseURL: "http://127.0.0.1:11434/v1" },
    ]);
    assert.match(yaml, /llm-pi-ai:/);
    assert.match(yaml, /baseURL: http:\/\/127.0.0.1:11434\/v1/);
    assert.equal(blocks.length, 1);
  });

  it("emits ollama ctx hints", () => {
    const hints = buildOllamaHints({ id: "ollama", open: true });
    assert.ok(hints.some((h) => /n_ctx|contextWindow/i.test(h)));
  });

  it("emits unsloth hints for llama service", () => {
    const hints = buildUnslothHints({ id: "llama", open: true });
    assert.ok(hints.some((h) => /Unsloth/i.test(h)));
  });

  it("emits docker hints when vllm port is closed", () => {
    const hints = buildVllmHints({ id: "vllm", open: false });
    assert.ok(hints.some((h) => /docker_doctor|Docker/i.test(h)));
  });

  it("parses ollama num_ctx and settings contextWindow", () => {
    assert.equal(parseOllamaNumCtx({ parameters: "num_ctx 32768\nnum_gpu 99" }), 32768);
    const map = parseSettingsContextWindows(`
llm-pi-ai:
  providers:
    ollama:
      models:
        - id: qwen38-27b-local
          contextWindow: 131072
`);
    assert.equal(map["qwen38-27b-local"], 131072);
    assert.equal(compareCtx(131072, 8192).ctxMatch, "mismatch");
    assert.equal(compareCtx(8192, 8192).ctxMatch, "ok");
    assert.equal(compareCtx(null, 8192).ctxMatch, "unknown");
  });
});

describe("toLossless", () => {
  it("strips undefined from nested tool payloads", async () => {
    const { toLossless } = await import("../lib/hostsvc.js");
    const cleaned = toLossless({ a: 1, b: undefined, c: { d: undefined, e: "" }, f: [1, undefined] });
    assert.deepEqual(cleaned, { a: 1, b: null, c: { d: null, e: "" }, f: [1, null] });
    assert.equal(JSON.stringify(cleaned).includes("undefined"), false);
  });
});
