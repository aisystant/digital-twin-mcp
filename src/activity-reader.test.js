import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  activityPeriod, createActivityReader, moscowToday, MAX_PERIOD_DAYS, MAX_ROWS,
} from "./activity-reader.js";
import { ACTIVITY_TOOL, CORE_TOOLS, toolsFor } from "./tool-catalog.js";
import worker from "./worker-sse.js";

const ME = "11111111-1111-4111-8111-111111111111";

function fakeSql(rows) {
  const calls = [];
  return {
    calls,
    async query(text, params) {
      calls.push({ text, params });
      if (rows instanceof Error) throw rows;
      return rows;
    },
  };
}

async function rpc(env, body) {
  const response = await worker.fetch(new Request("https://twin.example.invalid/mcp", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }), env);
  return response.json();
}

describe("activityPeriod", () => {
  it("defaults to the last 28 days ending today", () => {
    assert.deepEqual(activityPeriod({}, "2026-11-12"), { from: "2026-10-16", to: "2026-11-12" });
  });

  it("keeps an explicit inclusive period", () => {
    assert.deepEqual(activityPeriod({ from: "2026-11-01", to: "2026-11-05" }, "2026-11-12"),
      { from: "2026-11-01", to: "2026-11-05" });
  });

  it("rejects a future end, a reversed period, a period over the cap and a fake date", () => {
    for (const [args, message] of [
      [{ to: "2026-11-13" }, /later than today/],
      [{ from: "2026-11-05", to: "2026-11-01" }, /from cannot be later than to/],
      [{ from: "2025-01-01", to: "2026-11-12" }, new RegExp(`at most ${MAX_PERIOD_DAYS}`)],
      [{ from: "2026-02-30" }, /real calendar date/],
      [{ from: "12.11.2026" }, /YYYY-MM-DD/],
    ]) {
      assert.throws(() => activityPeriod(args, "2026-11-12"), (error) => {
        assert.equal(error.code, "invalid_period");
        assert.match(error.message, message);
        return true;
      });
    }
  });

  it("accepts exactly the maximum period", () => {
    const period = activityPeriod({ from: "2025-10-09", to: "2026-11-12" }, "2026-11-12");
    assert.equal((Date.parse(period.to) - Date.parse(period.from)) / 86400000 + 1, MAX_PERIOD_DAYS);
  });
});

describe("moscowToday", () => {
  it("switches the date at Moscow midnight, not UTC", () => {
    assert.equal(moscowToday(new Date("2026-11-11T20:59:59Z")), "2026-11-11");
    assert.equal(moscowToday(new Date("2026-11-11T21:00:00Z")), "2026-11-12");
  });
});

describe("createActivityReader", () => {
  const now = () => new Date("2026-11-12T06:00:00Z");

  it("asks the function for the caller's account only and returns numbers", async () => {
    const sql = fakeSql([{ day: "2026-11-11", channel: "bot", events: "3" }]);
    const result = await createActivityReader(sql, ME, { now }).readActivity({});
    assert.equal(sql.calls.length, 1);
    assert.match(sql.calls[0].text, /FROM public\.activity_days\(\$1::uuid, \$2::date, \$3::date\)/);
    assert.deepEqual(sql.calls[0].params, [ME, "2026-10-16", "2026-11-12", MAX_ROWS + 1]);
    assert.deepEqual(result, {
      source: "learning.domain_event",
      as_of: "2026-11-12T06:00:00.000Z",
      period: { from: "2026-10-16", to: "2026-11-12" },
      days: [{ day: "2026-11-11", channel: "bot", events: 3 }],
    });
  });

  it("ignores any account the client tries to pass", async () => {
    const sql = fakeSql([]);
    await createActivityReader(sql, ME, { now }).readActivity({ account_id: "22222222-2222-4222-8222-222222222222" });
    assert.equal(sql.calls[0].params[0], ME);
  });

  it("refuses a caller without a platform account before touching the database", async () => {
    for (const userId of [null, "telegram:123", ""]) {
      const sql = fakeSql([]);
      await assert.rejects(createActivityReader(sql, userId, { now }).readActivity({}), { code: "invalid_account" });
      assert.equal(sql.calls.length, 0);
    }
  });

  it("fails loudly instead of truncating above the row cap", async () => {
    const rows = Array.from({ length: MAX_ROWS + 1 }, () => ({ day: "2026-11-11", channel: "bot", events: 1 }));
    await assert.rejects(createActivityReader(fakeSql(rows), ME, { now }).readActivity({}), { code: "too_many_rows" });
  });

  it("turns a database failure into storage_error, not an empty board", async () => {
    await assert.rejects(createActivityReader(fakeSql(new Error("boom")), ME, { now }).readActivity({}),
      { code: "storage_error" });
  });
});

describe("read_activity registration", () => {
  it("is listed only when the learning database is configured", async () => {
    assert.deepEqual(toolsFor({}), CORE_TOOLS);
    assert.deepEqual(toolsFor({ LEARNING_ACTIVITY_URL: "postgresql://x" }), [...CORE_TOOLS, ACTIVITY_TOOL]);
    const listed = await rpc({ LEARNING_ACTIVITY_URL: "postgresql://x" }, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    assert.deepEqual(listed.result.tools.map((t) => t.name),
      ["describe_by_path", "read_digital_twin", "write_digital_twin", "read_activity"]);
    assert.equal(ACTIVITY_TOOL.inputSchema.properties.account_id, undefined);
    assert.equal(ACTIVITY_TOOL.inputSchema.additionalProperties, false);
  });

  it("reports missing_config in /health without the variable and configured with it", async () => {
    const off = await (await worker.fetch(new Request("https://twin.example.invalid/health"), {})).json();
    assert.equal(off.activity, "missing_config");
    assert.match(off.activity_detail, /LEARNING_ACTIVITY_URL/);
    const on = await (await worker.fetch(new Request("https://twin.example.invalid/health"),
      { LEARNING_ACTIVITY_URL: "postgresql://x" })).json();
    assert.equal(on.activity, "configured");
    assert.equal(on.activity_detail, undefined);
  });
});

describe("tools/call read_activity through the worker", async () => {
  const { exportJWK, generateKeyPair, SignJWT } = await import("jose");
  const { neonConfig } = await import("@neondatabase/serverless");
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "activity-key", alg: "RS256", use: "sig" };
  const fakeDbHost = "learning-db.test.invalid";
  let counter = 0;

  // Synthetic Gateway JWKS plus a fake Neon HTTP endpoint that records the SQL it receives.
  function setup(t) {
    const gatewayUrl = `https://gateway-activity-${++counter}.test.invalid`;
    const sent = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => String(input).startsWith(gatewayUrl)
      ? Response.json({ keys: [jwk] })
      : realFetch(input, init);
    // The Neon driver sends queries through neonConfig.fetchFunction when it is set.
    const neonFetchBefore = neonConfig.fetchFunction;
    neonConfig.fetchFunction = async (input, init) => {
      assert.match(String(input), /\/sql$/);  // the driver posts to its HTTP endpoint for the host
      sent.push(JSON.parse(init.body));
      return Response.json({ command: "SELECT", rowCount: 1, rowAsArray: true,
        fields: [{ name: "day", dataTypeID: 25 }, { name: "channel", dataTypeID: 25 }, { name: "events", dataTypeID: 23 }],
        rows: [["2026-11-11", "club", "2"]] });
    };
    t.after(() => { globalThis.fetch = realFetch; neonConfig.fetchFunction = neonFetchBefore; });
    return {
      sent,
      env: {
        GATEWAY_JWKS_URL: `${gatewayUrl}/gateway/.well-known/jwks.json`,
        LEARNING_ACTIVITY_URL: `postgresql://reader:x@${fakeDbHost}/learning`,
      },
    };
  }

  function assertionFor(sub) {
    return new SignJWT({ purpose: "registry" })
      .setProtectedHeader({ alg: "RS256", kid: "activity-key" })
      .setIssuer("iwe-gateway").setAudience("digital-twin-mcp").setSubject(sub)
      .setJti(crypto.randomUUID()).setIssuedAt().setExpirationTime("60s").sign(privateKey);
  }

  async function call(env, args, sub) {
    const headers = { "Content-Type": "application/json" };
    if (sub) headers["X-Gateway-Assertion"] = await assertionFor(sub);
    const response = await worker.fetch(new Request("https://twin.example.invalid/mcp", {
      method: "POST", headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "read_activity", arguments: args } }),
    }), env);
    return { status: response.status, body: await response.json() };
  }

  it("sends the asserted account, never the one in the arguments", async (t) => {
    const { env, sent } = setup(t);
    const { status, body } = await call(env,
      { account_id: "22222222-2222-4222-8222-222222222222", from: "2026-11-01", to: "2026-11-11" }, ME);
    assert.equal(status, 200);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].params.slice(0, 3), [ME, "2026-11-01", "2026-11-11"]);
    assert.deepEqual(JSON.parse(body.result.content[0].text).days, [{ day: "2026-11-11", channel: "club", events: 2 }]);
  });

  it("rejects an anonymous call before any database request", async (t) => {
    const { env, sent } = setup(t);
    const { status } = await call(env, {}, null);
    assert.equal(status, 401);
    assert.equal(sent.length, 0);
  });

  it("returns a JSON-RPC error with the code for a bad period, a non-account caller and a broken URL", async (t) => {
    const { env, sent } = setup(t);
    const badPeriod = await call(env, { from: "2026-11-05", to: "2026-11-01" }, ME);
    assert.equal(badPeriod.body.error.code, -32000);
    assert.equal(badPeriod.body.error.data.code, "invalid_period");
    assert.equal((await call(env, {}, "synthetic-user")).body.error.data.code, "invalid_account");
    assert.equal(sent.length, 0);
    // A malformed connection string fails on the first query: a JSON-RPC error, not a Worker 500.
    const broken = await call({ ...env, LEARNING_ACTIVITY_URL: "not a url" }, {}, ME);
    assert.equal(broken.status, 200);
    assert.equal(broken.body.error.data.code, "storage_error");
  });

  it("answers missing_config when called on a server without the variable", async (t) => {
    const { env } = setup(t);
    const { body } = await call({ GATEWAY_JWKS_URL: env.GATEWAY_JWKS_URL }, {}, ME);
    assert.equal(body.error.data.code, "missing_config");
  });
});
