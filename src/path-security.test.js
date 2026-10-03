import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { neonConfig } from "@neondatabase/serverless";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { METAMODEL } from "./metamodel-data.js";
import { setByPath, writeUserTwin } from "./twin-path.js";
import worker from "./worker-sse.js";

const INVALID_PATHS = [
  "", "/", ".", "///", "...", " ", undefined, null, 42, {},
  "unknown/x", "/unknown/x", "indicators/agency", "1_declarative_extra/x",
  "1_declarative//x", "1_declarative..x", "1_declarative/../x",
  "1_declarative\\x", "\\2_collected\\x", "1_declarative/ /x",
  "1_declarative/x\n", "1_declarative/x\u0000",
  "__proto__/polluted", "constructor/prototype/polluted",
  "1_declarative/__proto__/polluted",
  "1_declarative/constructor/prototype/polluted",
  "1_declarative/safe/prototype/polluted",
  "1_declarative/safe/__proto__", "1_declarative/constructor",
];
for (const category of ["2_collected", "3_derived", "4_generated"]) {
  INVALID_PATHS.push(
    `${category}/x`, `/${category}/x`, `.${category}.x`,
    `${category}.x`, `/${category}.x/`, `./${category}/x`,
  );
}

function syntheticStore(initial = { "1_declarative": { existing: "keep" } }) {
  const data = structuredClone(initial);
  let persisted = structuredClone(initial);
  let reads = 0;
  let writes = 0;
  return {
    data,
    options: {
      accessControl: METAMODEL.accessControl,
      store: {
        async mutate(change) {
          reads++;
          change(data);
          writes++;
          persisted = structuredClone(data);
          return { persisted: true, revision: "synthetic" };
        },
      },
    },
    snapshot: () => ({ data, persisted, reads, writes }),
  };
}

describe("user write path security (shared local/cloud implementation)", () => {
  it("rejects missing data before reading or mutating storage", async () => {
    const store = syntheticStore();
    const before = structuredClone(store.snapshot());
    const result = await writeUserTwin("1_declarative.existing", undefined, store.options);
    assert.equal(result.code, "invalid_data");
    assert.equal(result.success, undefined);
    assert.deepEqual(store.snapshot(), before);
  });

  for (const index of ["foo", "01", "00", "-1", "+1", "1e2", "length", "3", "1000000", "4294967295", "9007199254740993"]) {
    it(`rejects array property/index ${index} without changing stored data`, async () => {
      const store = syntheticStore({ "1_declarative": { items: [0, 1] } });
      const before = structuredClone(store.snapshot());
      const result = await writeUserTwin(`1_declarative.items/${index}`, "blocked", store.options);
      assert.equal(typeof result.error, "string");
      assert.equal(result.success, undefined);
      assert.deepEqual(store.snapshot().data, before.data);
      assert.deepEqual(store.snapshot().persisted, before.persisted);
      assert.equal(store.snapshot().writes, 0);
    });
  }

  it("persists canonical array indices, contiguous append and whole-array replacement", async () => {
    const store = syntheticStore({ "1_declarative": { items: [0, 1] } });
    assert.equal((await writeUserTwin("1_declarative.items/0", "changed", store.options)).success, true);
    assert.equal((await writeUserTwin("1_declarative.items/2", "appended", store.options)).success, true);
    assert.deepEqual(store.snapshot().persisted["1_declarative"].items, ["changed", 1, "appended"]);
    assert.equal((await writeUserTwin("1_declarative.items", ["replacement"], store.options)).success, true);
    assert.deepEqual(store.snapshot().persisted["1_declarative"].items, ["replacement"]);
  });

  for (const path of INVALID_PATHS) {
    it(`rejects ${JSON.stringify(path)} before accessing storage`, async () => {
      const store = syntheticStore();
      const before = structuredClone(store.snapshot());
      const prototypeBefore = Object.getOwnPropertyDescriptors(Object.prototype);
      const result = await writeUserTwin(path, "blocked", store.options);
      assert.equal(typeof result.error, "string");
      assert.equal(result.success, undefined);
      assert.deepEqual(store.snapshot(), before);
      assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), prototypeBefore);
    });
  }

  for (const path of [
    "1_declarative/1_2_goals/09_Цели обучения",
    "1_declarative.1_2_goals.09_Цели обучения",
    "/1_declarative/1_2_goals.09_Цели обучения/",
    ".1_declarative.1_2_goals/09_Цели обучения.",
  ]) {
    it(`persists the same declarative field through ${path}`, async () => {
      const store = syntheticStore();
      const result = await writeUserTwin(path, ["synthetic goal"], store.options);
      assert.equal(result.success, true);
      assert.equal(result.persisted, true);
      assert.equal(result.path, path);
      const expected = {
        "1_declarative": {
          existing: "keep",
          "1_2_goals": { "09_Цели обучения": ["synthetic goal"] },
        },
      };
      assert.deepEqual(store.snapshot(), { data: expected, persisted: expected, reads: 1, writes: 1 });
    });
  }

  for (const value of [null, false, 0, "text", ["goal"], { active: true }]) {
    it(`preserves the JSON value ${JSON.stringify(value)}`, async () => {
      const store = syntheticStore();
      const result = await writeUserTwin("1_declarative/custom_field", value, store.options);
      assert.equal(result.success, true);
      assert.deepEqual(store.snapshot().persisted["1_declarative"].custom_field, value);
    });
  }

  it("does not traverse an inherited property", async () => {
    const prototypeBefore = Object.getOwnPropertyDescriptors(Object.prototype.toString);
    const store = syntheticStore();
    const result = await writeUserTwin("1_declarative/toString/value", 42, store.options);
    assert.equal(result.success, true);
    assert.deepEqual(store.snapshot().persisted["1_declarative"].toString, { value: 42 });
    assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype.toString), prototypeBefore);
  });

  for (const parent of [null, false, 42, "text"]) {
    it(`refuses traversal through ${JSON.stringify(parent)} without mutation`, async () => {
      const store = syntheticStore({ "1_declarative": { parent } });
      const before = structuredClone(store.snapshot());
      const result = await writeUserTwin("1_declarative/parent/child", 42, store.options);
      assert.match(result.error, /parent is not an object/);
      assert.deepEqual(store.snapshot(), { ...before, reads: 1 });
    });
  }

  it("rejects array length writes without changing or persisting data", async () => {
    const store = syntheticStore({ "1_declarative": { goals: ["keep", "also keep"] } });
    const before = structuredClone(store.snapshot());
    const result = await writeUserTwin("1_declarative/goals/length", 0, store.options);
    assert.match(result.error, /arrays accept only/);
    assert.equal(result.success, undefined);
    assert.deepEqual(store.snapshot(), { ...before, reads: 1 });
  });

  it("fails closed when the access matrix has no own user-write permission", async () => {
    for (const accessControl of [undefined, {}, Object.create(METAMODEL.accessControl)]) {
      const store = syntheticStore();
      const before = structuredClone(store.snapshot());
      const result = await writeUserTwin("1_declarative/x", 42, { ...store.options, accessControl });
      assert.match(result.error, /Access denied/);
      assert.deepEqual(store.snapshot(), before);
    }
  });

  it("cannot grant user access to system categories through the matrix", async () => {
    const store = syntheticStore();
    const before = structuredClone(store.snapshot());
    const result = await writeUserTwin("3_derived/rcs_profile", {}, {
      ...store.options,
      accessControl: { "3_derived": { user: "rw" } },
    });
    assert.match(result.error, /Access denied/);
    assert.deepEqual(store.snapshot(), before);
  });
});

describe("trusted fixed-path system writes", () => {
  it("retains the local RCS profile and history paths", () => {
    const data = {};
    setByPath(data, "3_derived/rcs_profile", { agency: 0.8 });
    setByPath(data, "3_derived/rcs_history", [{ agency: 0.7 }]);
    assert.deepEqual(data, { "3_derived": {
      rcs_profile: { agency: 0.8 }, rcs_history: [{ agency: 0.7 }],
    } });
  });

  it("still refuses prototype paths before mutating the object", () => {
    const data = {};
    const prototypeBefore = Object.getOwnPropertyDescriptors(Object.prototype);
    assert.throws(() => setByPath(data, "3_derived/new/__proto__/polluted", true), /prototype/);
    assert.deepEqual(data, {});
    assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), prototypeBefore);
  });
});

describe("transport regressions with synthetic storage", () => {
  it("stdio rejects unsafe writes without changing the file and retains root reads", { timeout: 10000 }, async (t) => {
    const repo = fileURLToPath(new URL("..", import.meta.url));
    const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "dt-path-security-"));
    const client = new Client({ name: "path-security-test", version: "1.0.0" });
    t.after(async () => {
      await client.close();
      await fs.rm(fixture, { recursive: true, force: true });
    });
    await fs.cp(path.join(repo, "src"), path.join(fixture, "src"), { recursive: true });
    await fs.copyFile(path.join(repo, "package.json"), path.join(fixture, "package.json"));
    await fs.symlink(path.join(repo, "node_modules"), path.join(fixture, "node_modules"), "dir");
    await fs.mkdir(path.join(fixture, "data"));
    const dataPath = path.join(fixture, "data", "twin.json");
    const initial = { "1_declarative": { existing: "keep", items: [0, 1] }, "2_collected": { x: 1 } };
    const initialBytes = JSON.stringify(initial);
    await fs.writeFile(dataPath, initialBytes);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(fixture, "src", "index.js")],
      env: { DATABASE_URL: "", DT_USER_ID: "", LEARNING_URL: "" },
      stderr: "pipe",
    });
    await client.connect(transport);
    transport.stderr?.resume();

    for (const unsafePath of INVALID_PATHS) {
      const result = await client.callTool({
        name: "write_digital_twin", arguments: { path: unsafePath, data: "blocked" },
      });
      assert.equal(result.isError, true, `Expected error for ${JSON.stringify(unsafePath)}`);
      assert.equal(await fs.readFile(dataPath, "utf8"), initialBytes);
    }
    const missing = await client.callTool({ name: "write_digital_twin", arguments: { path: "1_declarative.existing" } });
    assert.equal(missing.isError, true);
    assert.equal(JSON.parse(missing.content[0].text).code, "invalid_data");
    assert.equal(await fs.readFile(dataPath, "utf8"), initialBytes);
    for (const index of ["foo", "01", "1000000"]) {
      const result = await client.callTool({ name: "write_digital_twin", arguments: { path: `1_declarative.items/${index}`, data: "blocked" } });
      assert.equal(result.isError, true);
      assert.equal(await fs.readFile(dataPath, "utf8"), initialBytes);
    }
    for (const root of ["", "/", "."]) {
      const result = await client.callTool({ name: "read_digital_twin", arguments: { path: root } });
      assert.deepEqual(JSON.parse(result.content[0].text), initial);
    }
    const value = ["synthetic goal"];
    const result = await client.callTool({
      name: "write_digital_twin",
      arguments: { path: "/1_declarative/goals.learning/", data: value },
    });
    assert.notEqual(result.isError, true);
    const persisted = JSON.parse(await fs.readFile(dataPath, "utf8"));
    assert.deepEqual(persisted, {
      ...initial, "1_declarative": { ...initial["1_declarative"], goals: { learning: value } },
    });
    for (const [field, data, expected] of [
      ["1_declarative.items/2", "appended", [0, 1, "appended"]],
      ["1_declarative.items", ["replacement"], ["replacement"]],
    ]) {
      const result = await client.callTool({ name: "write_digital_twin", arguments: { path: field, data } });
      assert.notEqual(result.isError, true);
      assert.deepEqual(JSON.parse(await fs.readFile(dataPath, "utf8"))["1_declarative"].items, expected);
    }
  });

  it("HTTP checks paths before database calls and retains cloud value parsing and root reads", { timeout: 10000 }, async (t) => {
    t.mock.method(console, "log", () => {});
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const publicJwk = { ...await exportJWK(publicKey), kid: "synthetic", alg: "RS256", use: "sig" };
    const issuer = "https://auth.example.invalid";
    t.mock.method(globalThis, "fetch", async (url) => {
      assert.equal(String(url), `${issuer}/.well-known/jwks.json`);
      return Response.json({ keys: [publicJwk] });
    });
    const token = await new SignJWT({ sub: "synthetic-user" })
      .setProtectedHeader({ alg: "RS256", kid: "synthetic" })
      .setIssuer(`${issuer}/`).setExpirationTime("5m").sign(privateKey);
    let persisted = { "1_declarative": { existing: "keep", items: [0, 1] }, "2_collected": { x: 1 } };
    const initial = structuredClone(persisted);
    let databaseCalls = 0;
    const originalFetch = neonConfig.fetchFunction;
    t.after(() => { neonConfig.fetchFunction = originalFetch; });
    neonConfig.fetchFunction = async (_url, options) => {
      databaseCalls++;
      const { query, params } = JSON.parse(options.body);
      if (!query.startsWith("SELECT")) {
        assert.match(query, /UPDATE "digital_twins"/);
        assert.equal(params[0], "synthetic-user");
        assert.deepEqual(JSON.parse(params[2]), persisted);
        persisted = JSON.parse(params[1]);
      }
      return Response.json({
        fields: [{ name: "raw", dataTypeID: 25 }],
        rows: [[JSON.stringify(persisted)]], rowCount: 1, command: query.split(" ")[0],
      });
    };
    const env = {
      ORY_URL: issuer,
      DATABASE_URL: "postgresql://synthetic@ep-test.example.invalid/test",
    };
    async function callTool(name, args, requestEnv = env) {
      const request = new Request("https://twin.example.invalid/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
      });
      const response = await worker.fetch(request, requestEnv);
      assert.equal(response.status, 200);
      return response.json();
    }

    for (const unsafePath of INVALID_PATHS) {
      const response = await callTool("write_digital_twin", { path: unsafePath, data: "blocked" });
      assert.equal(response.error?.code, -32000, `Expected error for ${JSON.stringify(unsafePath)}`);
      assert.equal(databaseCalls, 0);
      assert.deepEqual(persisted, initial);
    }
    const missing = await callTool("write_digital_twin", { path: "1_declarative.existing" });
    assert.equal(missing.error.data.code, "invalid_data");
    assert.equal(databaseCalls, 0);
    for (const index of ["foo", "01", "1000000"]) {
      const rejected = await callTool("write_digital_twin", { path: `1_declarative.items/${index}`, data: "blocked" });
      assert.equal(rejected.error.code, -32000);
      assert.deepEqual(persisted, initial);
    }
    const rejectedReads = databaseCalls;
    for (const root of ["", "/", "."]) {
      const response = await callTool("read_digital_twin", { path: root });
      assert.deepEqual(JSON.parse(response.result.content[0].text), initial);
    }
    const response = await callTool("write_digital_twin", {
      path: "/1_declarative/goals.learning/", data: '["synthetic goal"]',
    });
    const result = JSON.parse(response.result.content[0].text);
    assert.equal(result.success, true);
    assert.equal(result.persisted, true);
    assert.deepEqual(persisted, {
      ...initial, "1_declarative": { ...initial["1_declarative"], goals: { learning: ["synthetic goal"] } },
    });
    assert.equal(databaseCalls, rejectedReads + 5);
    for (const [field, data, expected] of [
      ["1_declarative.items/2", "appended", [0, 1, "appended"]],
      ["1_declarative.items", ["replacement"], ["replacement"]],
    ]) {
      const saved = await callTool("write_digital_twin", { path: field, data });
      assert.equal(JSON.parse(saved.result.content[0].text).success, true);
      assert.deepEqual(persisted["1_declarative"].items, expected);
    }

    await callTool("write_digital_twin", { path: "1_declarative.message", data: { error: "stored value" } });
    const messageRead = await callTool("read_digital_twin", { path: "1_declarative.message", include_revision: true });
    assert.deepEqual(JSON.parse(messageRead.result.content[0].text).data, { error: "stored value" });
    const versionedRead = await callTool("read_digital_twin", { path: "/", include_revision: true });
    const snapshot = JSON.parse(versionedRead.result.content[0].text);
    assert.deepEqual(snapshot.data, persisted);
    assert.match(snapshot.revision, /^v1:[a-f0-9]{64}$/);
    const strictWrite = await callTool("write_digital_twin", {
      path: "1_declarative.strict", data: true, expected_revision: snapshot.revision,
    });
    assert.equal(JSON.parse(strictWrite.result.content[0].text).success, true);
    const beforeConflict = structuredClone(persisted);
    const conflict = await callTool("write_digital_twin", {
      path: "1_declarative.blocked", data: true, expected_revision: snapshot.revision,
    });
    assert.equal(conflict.error.data.code, "revision_conflict");
    assert.deepEqual(persisted, beforeConflict);
    const callsBeforeInvalid = databaseCalls;
    const invalid = await callTool("write_digital_twin", {
      path: "1_declarative.blocked", data: true, expected_revision: null,
    });
    assert.equal(invalid.error.data.code, "invalid_revision");
    assert.equal(databaseCalls, callsBeforeInvalid);
    const unavailable = await callTool("write_digital_twin", {
      path: "1_declarative.blocked", data: true,
    }, { ORY_URL: issuer });
    assert.equal(unavailable.error.data.code, "storage_unavailable");
    assert.equal(databaseCalls, callsBeforeInvalid);
    assert.deepEqual(persisted, beforeConflict);
  });
});
