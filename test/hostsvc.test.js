import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHostReachAdvice,
  candidateBases,
  formatHostReachReport,
} from "../lib/hostsvc.js";

describe("host_reach", () => {
  it("includes loopback and nameserver candidates", () => {
    const bases = candidateBases({ nameserver: "172.28.160.1", mirrored: "mirrored" });
    assert.ok(bases.includes("http://127.0.0.1"));
    assert.ok(bases.includes("http://localhost"));
    assert.ok(bases.includes("http://172.28.160.1"));
  });

  it("advises settings.yaml when a probe works", () => {
    const advice = buildHostReachAdvice({
      probes: [{ ok: true, baseURL: "http://127.0.0.1:11434", ollama: true }],
      nameserver: "1.2.3.4",
    });
    assert.ok(advice.some((t) => /settings\.yaml/i.test(t)));
    assert.ok(advice.some((t) => /127\.0\.0\.1:11434/.test(t)));
  });

  it("formats report", () => {
    assert.match(
      formatHostReachReport({
        probes: [{ baseURL: "http://127.0.0.1:11434", tcp: true, http: { ok: true }, ollama: true }],
        advice: ["ok"],
      }),
      /ollama=yes/,
    );
  });
});
