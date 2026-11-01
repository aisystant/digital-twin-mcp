import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CORE_TOOLS, SERVER_VERSION } from "./tool-catalog.js";
import worker from "./worker-sse.js";

async function rpc(method) {
  const response = await worker.fetch(new Request("https://twin.example.invalid/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method }),
  }), {});
  assert.equal(response.status, 200);
  return (await response.json()).result;
}

describe("tool catalog contract over HTTP", () => {
  it("advertises exactly the three shared tools", async () => {
    assert.equal(CORE_TOOLS.length, 3);
    assert.deepEqual((await rpc("tools/list")).tools, CORE_TOOLS);
  });

  it("reports the package version as the server version", async () => {
    const response = await worker.fetch(new Request("https://twin.example.invalid/health"), {});
    assert.equal((await response.json()).version, SERVER_VERSION);
  });
});
