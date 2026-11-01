/**
 * Audit 2026-11-01: confirmed defects (docs/AUDIT-2026-11-01.md).
 *
 * Fixed defects are regular regression tests. Open defects use knownDefect():
 * the test body asserts the CORRECT behaviour; knownDefect passes while that
 * assertion fails and turns RED once the defect is fixed, so a fix cannot land
 * without converting the test into a regular one.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import worker from "./worker-sse.js";

function knownDefect(id, body) {
  return async (t) => {
    let fixed = false;
    try {
      await body(t);
      fixed = true;
    } catch (error) {
      t.diagnostic(`known defect ${id} still present: ${error.message.split("\n")[0]}`);
    }
    if (fixed) assert.fail(`${id} is fixed: replace knownDefect() with a regular test`);
  };
}

// ---------- HTTP worker helpers ----------

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "audit-key", alg: "RS256", use: "sig" };
let oryCounter = 0;

/** Fresh synthetic issuer per test: the worker caches JWKS per issuer URL. */
function syntheticOry(t) {
  const oryUrl = `https://ory-${++oryCounter}.audit.invalid`;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => String(input).startsWith(oryUrl)
    ? new Response(JSON.stringify({ keys: [jwk] }), { headers: { "content-type": "application/json" } })
    : realFetch(input, init);
  t.after(() => { globalThis.fetch = realFetch; });
  return oryUrl;
}

function token(oryUrl, audience) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "audit-key" })
    .setIssuer(`${oryUrl}/`).setSubject("synthetic-user").setAudience(audience)
    .setExpirationTime("5m").sign(privateKey);
}

function post(env, body, bearer, extraHeaders = {}) {
  return worker.fetch(new Request("https://audit.invalid/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...extraHeaders },
    body,
  }), env);
}

function silenceWarnings(t) {
  const original = console.warn;
  console.warn = () => {};
  t.after(() => { console.warn = original; });
}

function silenceLogs(t) {
  silenceWarnings(t);
  const original = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.map(String).join(" "));
  t.after(() => { console.log = original; });
  return lines;
}

const describeRoot = JSON.stringify({
  jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "describe_by_path", arguments: { path: "/" } },
});

const listTools = JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" });

describe("audit 2026-11-01: HTTP worker (fixed)", () => {
  it("F1: rejects a token issued to another OAuth client when JWT_AUDIENCE is set", async (t) => {
    silenceLogs(t);
    const ory = syntheticOry(t);
    const env = { ORY_URL: ory, JWT_AUDIENCE: "digital-twin-mcp" };
    const foreign = await post(env, describeRoot, await token(ory, "some-other-oauth-client"));
    assert.equal(foreign.status, 401);
    assert.equal((await foreign.json()).error.data.reason, "invalid_token");
    const own = await post(env, describeRoot, await token(ory, "digital-twin-mcp"));
    assert.equal(own.status, 200);
    assert.ok((await own.json()).result);
  });

  it("F7: refuses requests without the Gateway secret when GATEWAY_SHARED_SECRET is set", async (t) => {
    silenceLogs(t);
    const ory = syntheticOry(t);
    const env = { ORY_URL: ory, GATEWAY_SHARED_SECRET: "synthetic-gateway-secret" };
    const bearer = await token(ory, "any");
    for (const headers of [{}, { "X-Gateway-Secret": "wrong" }]) {
      const direct = await post(env, describeRoot, bearer, headers);
      assert.equal(direct.status, 403);
      assert.equal((await direct.json()).error.data.reason, "gateway_required");
    }
    const directList = await post(env, listTools, undefined);
    assert.equal(directList.status, 403);
    const viaGateway = await post(env, describeRoot, bearer, { "X-Gateway-Secret": "synthetic-gateway-secret" });
    assert.equal(viaGateway.status, 200);
  });

  it("keeps tools/list public without a token", async (t) => {
    silenceLogs(t);
    const response = await post({ ORY_URL: syntheticOry(t) }, listTools);
    assert.equal(response.status, 200);
    assert.ok(Array.isArray((await response.json()).result.tools));
  });

  it("F4: answers malformed JSON with a JSON-RPC parse error instead of throwing", async (t) => {
    silenceLogs(t);
    const response = await post({ ORY_URL: syntheticOry(t) }, "{not json");
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, -32700);
  });

  it("verifies the token before parsing the body", async (t) => {
    silenceLogs(t);
    const response = await post({ ORY_URL: syntheticOry(t) }, "{not json", "not-a-valid-token");
    assert.equal(response.status, 401);
  });

  it("rejects bodies larger than 1 MiB", async (t) => {
    silenceLogs(t);
    const response = await post({ ORY_URL: syntheticOry(t) }, JSON.stringify({ pad: "x".repeat(1024 * 1024) }));
    assert.equal(response.status, 413);
  });

  it("F5: answers tools/call without params with invalid params instead of throwing", async (t) => {
    silenceLogs(t);
    const ory = syntheticOry(t);
    const response = await post({ ORY_URL: ory },
      JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call" }), await token(ory, "any"));
    assert.equal((await response.json()).error.code, -32602);
  });

  it("F6: does not write any part of DATABASE_URL to logs", async (t) => {
    const lines = silenceLogs(t);
    await worker.fetch(new Request("https://audit.invalid/health"),
      { DATABASE_URL: "postgresql://db.invalid/synthetic" });
    assert.ok(!lines.some((line) => line.includes("postgresql://")), lines.join("\n"));
  });
});

describe("audit 2026-11-01: HTTP worker (open)", () => {
  it("F8: acknowledges a notification with 202 and no body (pre-2026-07-28 clients)",
    knownDefect("F8", async (t) => {
      silenceLogs(t);
      const ory = syntheticOry(t);
      const response = await post({ ORY_URL: ory },
        JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }), await token(ory, "any"));
      assert.equal(response.status, 202);
      assert.equal(await response.text(), "");
    }));
});

// ---------- stdio helpers ----------

async function stdioClient(t, initial = { "1_declarative": {} }) {
  const repo = fileURLToPath(new URL("..", import.meta.url));
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "dt-audit-"));
  const client = new Client({ name: "audit-findings-test", version: "1.0.0" });
  t.after(async () => {
    await client.close();
    await fs.rm(fixture, { recursive: true, force: true });
  });
  await fs.cp(path.join(repo, "src"), path.join(fixture, "src"), { recursive: true });
  await fs.cp(path.join(repo, "metamodel"), path.join(fixture, "metamodel"), { recursive: true });
  await fs.copyFile(path.join(repo, "package.json"), path.join(fixture, "package.json"));
  await fs.symlink(path.join(repo, "node_modules"), path.join(fixture, "node_modules"), "dir");
  await fs.mkdir(path.join(fixture, "data"));
  await fs.writeFile(path.join(fixture, "data", "twin.json"), JSON.stringify(initial));
  await fs.writeFile(path.join(fixture, "outside-secret.txt"), "SYNTHETIC-SECRET");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(fixture, "src", "index.js")],
    env: { DATABASE_URL: "", DT_USER_ID: "", LEARNING_URL: "" },
    stderr: "pipe",
  });
  await client.connect(transport);
  transport.stderr?.resume();
  return client;
}

const text = (result) => result.content[0].text;

describe("audit 2026-11-01: stdio server (open)", () => {
  it("F2: describe_by_path does not read files outside the metamodel directory",
    { timeout: 10000 }, knownDefect("F2", async (t) => {
    const client = await stdioClient(t);
    for (const escape of ["../outside-secret.txt", "../outside-secret"]) {
      const result = await client.callTool({ name: "describe_by_path", arguments: { path: escape } });
      assert.ok(!text(result).includes("SYNTHETIC-SECRET"), `read outside metamodel via ${escape}`);
    }
  }));

  it("F3: returns a string written by the user as the same string",
    { timeout: 10000 }, knownDefect("F3", async (t) => {
    const client = await stdioClient(t);
    const value = "[1, 2]";
    await client.callTool({ name: "write_digital_twin", arguments: { path: "1_declarative.note", data: value } });
    const read = await client.callTool({ name: "read_digital_twin", arguments: { path: "1_declarative.note" } });
    assert.equal(JSON.parse(text(read)), value);
  }));
});
