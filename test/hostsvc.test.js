import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { format } from "../lib/hostsvc.js";

describe("host_reach", () => {
  it("formats", () => {
    assert.match(format({ ok: true }), /ok/i);
  });
});
