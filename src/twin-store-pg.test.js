import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { neon, neonConfig } from "@neondatabase/serverless";
import { createPostgresStore } from "./twin-store.js";
import { setByPath } from "./twin-path.js";

const run = promisify(execFile);
let dbUrl;
let directory;
let postgresStarted = false;
let fetchBefore;
let beforeCas = async () => {};
let casCalls = 0;

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function psql(statement) {
  return new Promise((resolve, reject) => {
    const process = spawn("psql", [dbUrl, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    process.stdout.on("data", (chunk) => { stdout += chunk; });
    process.stderr.on("data", (chunk) => { stderr += chunk; });
    process.on("error", reject);
    process.on("close", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr)));
    process.stdin.end(statement);
  });
}

// A local test-only HTTP endpoint adapter: the real Neon SDK sends SQL/parameters,
// PostgreSQL PREPARE/EXECUTE performs the actual query, and Neon decodes its result.
async function neonFetch(_url, options) {
  const { query, params } = JSON.parse(options.body);
  if (/^(UPDATE|INSERT)/.test(query)) { casCalls++; await beforeCas(); }
  const literals = params.map((value) => value === null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`);
  const statement = params.length
    ? `PREPARE dt_test_query AS ${query}; EXECUTE dt_test_query(${literals.join(",")});`
    : query;
  const output = await psql(statement);
  const rows = output ? output.split("\n").map((raw) => [raw]) : [];
  return new Response(JSON.stringify({
    fields: [{ name: "raw", dataTypeID: 25 }], rows, rowCount: rows.length,
    command: query.split(" ")[0], rowAsArray: true,
  }), { status: 200 });
}

before(async () => {
  if (process.env.DT_TEST_POSTGRES_URL) {
    dbUrl = process.env.DT_TEST_POSTGRES_URL;
    const url = new URL(dbUrl);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/dt_cas_test") {
      throw new Error("DT_TEST_POSTGRES_URL must point to a local disposable dt_cas_test database");
    }
  } else {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "dt-pg-test-"));
    const data = path.join(directory, "data");
    const port = await availablePort();
    await run("initdb", ["-D", data, "-U", "dt_test", "-A", "trust", "--no-locale", "--encoding=UTF8"]);
    await run("pg_ctl", ["-D", data, "-l", path.join(directory, "server.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${directory}`, "-w", "start"]);
    postgresStarted = true;
    dbUrl = `postgresql://dt_test@127.0.0.1:${port}/postgres`;
    await psql("CREATE DATABASE dt_cas_test;");
    dbUrl = `postgresql://dt_test@127.0.0.1:${port}/dt_cas_test`;
  }
  await psql(`CREATE SCHEMA dt_override;
    CREATE TABLE public.digital_twins (user_id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT NOW());`);
  fetchBefore = neonConfig.fetchFunction;
  neonConfig.fetchFunction = neonFetch;
});

after(async () => {
  if (fetchBefore !== undefined) neonConfig.fetchFunction = fetchBefore;
  if (directory) {
    if (postgresStarted) await run("pg_ctl", ["-D", path.join(directory, "data"), "-m", "fast", "-w", "stop"]);
    await fs.rm(directory, { recursive: true, force: true });
  }
});

const sql = neon("postgresql://dt_test@localhost/dt_cas_test");

describe("real PostgreSQL with the Neon SDK", () => {
  it("supports a configured schema, parameterized user IDs and exact untouched numeric values", async () => {
    const store = createPostgresStore(sql, "synthetic' user", { schema: "dt_override", ensureTable: true });
    await store.mutate((data) => setByPath(data, "1_declarative.x", "saved"));
    assert.equal((await store.readSnapshot()).data["1_declarative"].x, "saved");
    assert.equal(await psql("SELECT count(*) FROM public.digital_twins;"), "0");
    await psql(`UPDATE dt_override.digital_twins SET data = data || '{"2_collected":{"large":9007199254740993,"decimal":0.1234567890123456789}}'::jsonb;`);
    await store.mutate((data) => setByPath(data, "1_declarative.y", "second"));
    assert.equal(await psql("SELECT data->'2_collected'->>'large' FROM dt_override.digital_twins;"), "9007199254740993");
    assert.equal(await psql("SELECT data->'2_collected'->>'decimal' FROM dt_override.digital_twins;"), "0.1234567890123456789");
  });

  it("merges concurrent legacy writers from two independent storage clients", async () => {
    const user = "two-clients";
    const stores = [createPostgresStore(sql, user), createPostgresStore(sql, user)];
    await Promise.all(stores.map((store, index) => store.mutate((data) => setByPath(data, `1_declarative.field${index}`, true))));
    assert.deepEqual((await stores[0].readSnapshot()).data, { "1_declarative": { field0: true, field1: true } });
  });

  it("allows one strict writer only and leaves the losing change unapplied", async () => {
    const store = createPostgresStore(sql, "strict-race");
    const { revision } = await store.readSnapshot();
    const outcomes = await Promise.allSettled(["a", "b"].map((field) => store.mutate((data) => setByPath(data, `1_declarative.${field}`, true), { expectedRevision: revision })));
    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
    assert.equal(outcomes.find((outcome) => outcome.status === "rejected").reason.code, "revision_conflict");
    assert.equal(Object.keys((await store.readSnapshot()).data["1_declarative"]).length, 1);
  });

  it("detects an external atomic merge between read and CAS without a revision column", async () => {
    const store = createPostgresStore(sql, "external");
    await store.mutate((data) => setByPath(data, "1_declarative.initial", true));
    let injected = false;
    beforeCas = async () => {
      if (injected) return;
      injected = true;
      await psql(`UPDATE public.digital_twins SET data = data || '{"2_collected":{"external":42}}'::jsonb WHERE user_id='external';`);
    };
    try {
      await store.mutate((data) => setByPath(data, "1_declarative.next", true));
    } finally { beforeCas = async () => {}; }
    assert.deepEqual((await store.readSnapshot()).data, {
      "1_declarative": { initial: true, next: true }, "2_collected": { external: 42 },
    });
  });

  it("does not retry a strict SQL conflict or write with an already stale revision", async () => {
    const store = createPostgresStore(sql, "strict-external");
    await store.mutate((data) => setByPath(data, "1_declarative.initial", true));
    const { revision } = await store.readSnapshot();
    beforeCas = async () => {
      await psql(`UPDATE public.digital_twins SET data = data || '{"2_collected":{"external":true}}'::jsonb WHERE user_id='strict-external';`);
    };
    const before = casCalls;
    try {
      await assert.rejects(store.mutate((data) => setByPath(data, "1_declarative.blocked", true), { expectedRevision: revision }), { code: "revision_conflict" });
    } finally { beforeCas = async () => {}; }
    assert.equal(casCalls, before + 1);
    await assert.rejects(store.mutate(() => assert.fail("stale reducer must not run"), { expectedRevision: revision }), { code: "revision_conflict" });
    assert.equal(casCalls, before + 1);
    assert.deepEqual((await store.readSnapshot()).data, { "1_declarative": { initial: true }, "2_collected": { external: true } });
  });
});
