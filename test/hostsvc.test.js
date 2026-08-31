import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { format, parameters, SERVICE_PORTS } from "../lib/hostsvc.js";

describe("host_reach", () => {
  it("formats multi-service results", () => {
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
      advice: ["ok"],
    });
    assert.match(text, /ollama/i);
    assert.match(text, /11434/);
    assert.match(text, /suggestedBaseURL/);
  });

  it("declares known service ports", () => {
    assert.equal(SERVICE_PORTS.ollama.port, 11434);
    assert.equal(SERVICE_PORTS.lmstudio.port, 1234);
    assert.equal(SERVICE_PORTS.vllm.port, 8000);
    assert.equal(SERVICE_PORTS.llama.port, 8080);
  });

  it("exposes profile parameter", () => {
    const p = parameters();
    assert.ok(p.properties.profile);
    assert.ok(p.properties.profile.enum.includes("all"));
  });
});
