import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOllamaHints,
  buildProviderSnippets,
  buildUnslothHints,
  buildVllmHints,
  CONNECTIVITY_PLAYBOOK,
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
});
