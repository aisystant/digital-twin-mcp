import assert from "node:assert/strict";
import { neonConfig } from "@neondatabase/serverless";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import worker from "./worker-sse.js";

let issuerCounter = 0;

// Writes through the HTTP worker against a faked Neon endpoint and returns what was persisted.
export async function writeAndRead(t, writes) {
  t.mock.method(console, "log", () => {});
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = { ...await exportJWK(publicKey), kid: "synthetic", alg: "RS256", use: "sig" };
  // The worker caches JWKS per issuer URL, so every call needs its own issuer and key pair.
  const issuer = `https://auth-${issuerCounter++}.example.invalid`;
  t.mock.method(globalThis, "fetch", async () => Response.json({ keys: [publicJwk] }));
  const token = await new SignJWT({ sub: "synthetic-user" })
    .setProtectedHeader({ alg: "RS256", kid: "synthetic" })
    .setIssuer(`${issuer}/`).setExpirationTime("5m").sign(privateKey);
  let persisted = { "1_declarative": {} };
  const originalFetch = neonConfig.fetchFunction;
  t.after(() => { neonConfig.fetchFunction = originalFetch; });
  neonConfig.fetchFunction = async (_url, options) => {
    const { query, params } = JSON.parse(options.body);
    if (!query.startsWith("SELECT")) persisted = JSON.parse(params[1]);
    return Response.json({
      fields: [{ name: "raw", dataTypeID: 25 }],
      rows: [[JSON.stringify(persisted)]], rowCount: 1, command: query.split(" ")[0],
    });
  };
  const env = { ORY_URL: issuer, DATABASE_URL: "postgresql://synthetic@ep-test.example.invalid/test" };
  for (const [field, data] of writes) {
    const response = await worker.fetch(new Request("https://twin.example.invalid/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "tools/call",
        params: { name: "write_digital_twin", arguments: { path: `1_declarative.${field}`, data } },
      }),
    }), env);
    const body = await response.json();
    assert.equal(JSON.parse(body.result.content[0].text).success, true, `write of ${field}`);
  }
  return persisted["1_declarative"];
}
