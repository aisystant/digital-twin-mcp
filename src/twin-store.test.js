import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createPostgresStore, snapshotFromRaw, twinTableName } from "./twin-store.js";
import { createFileStore } from "./file-twin-store.js";
import { setByPath } from "./twin-path.js";

function memorySql(initial, onCas = () => {}) {
  let raw = initial;
  let writes = 0;
  return {
    get raw() { return raw; },
    get writes() { return writes; },
    set raw(value) { raw = value; },
    async query(text, params) {
      if (text.startsWith("SELECT")) return raw === null ? [] : [{ raw }];
      writes++;
      onCas(this);
      const match = text.startsWith("INSERT") ? raw === null : raw === params[2];
      if (!match) return [];
      raw = params[1];
      return [{ raw }];
    },
  };
}

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dt-cas-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "twin.json");
  await fs.writeFile(filename, '{"1_declarative":{},"2_collected":{"keep":true}}');
  return { directory, filename, store: createFileStore(filename) };
}

function child(code, args = []) {
  return new Promise((resolve, reject) => {
    const process = spawn(globalThis.process.execPath, ["--input-type=module", "-e", code, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    process.stdout.on("data", (chunk) => { output += chunk; });
    process.stderr.on("data", (chunk) => { output += chunk; });
    process.on("error", reject);
    process.on("close", (code, signal) => code === 0 ? resolve(output) : reject(new Error(output || `Child exited: ${signal ?? code}`)));
  });
}

const storeUrl = new URL("./file-twin-store.js", import.meta.url).href;

describe("content snapshot CAS", () => {
  it("retries a legacy path mutation on the latest data, preserving an external merge", async () => {
    const sql = memorySql('{"1_declarative":{}}', (db) => {
      if (db.writes === 1) db.raw = '{"1_declarative":{},"2_collected":{"external":42}}';
    });
    const store = createPostgresStore(sql, "synthetic");
    const saved = await store.mutate((data) => setByPath(data, "1_declarative.x", "new"));
    assert.equal(sql.writes, 2);
    assert.equal(saved.persisted, true);
    assert.deepEqual(JSON.parse(sql.raw), { "1_declarative": { x: "new" }, "2_collected": { external: 42 } });
    assert.equal(saved.revision, (await store.readSnapshot()).revision);
  });

  it("never retries a strict conflict, and does not write when already stale", async () => {
    const initial = '{"1_declarative":{}}';
    const sql = memorySql(initial, (db) => { db.raw = '{"1_declarative":{"other":true}}'; });
    const store = createPostgresStore(sql, "synthetic");
    const revision = (await store.readSnapshot()).revision;
    await assert.rejects(store.mutate((data) => setByPath(data, "1_declarative.x", 1), {
      expectedRevision: revision,
    }), { code: "revision_conflict" });
    assert.equal(sql.writes, 1);
    assert.deepEqual(JSON.parse(sql.raw), { "1_declarative": { other: true } });
    await assert.rejects(store.mutate(() => assert.fail("must not run"), {
      expectedRevision: revision,
    }), { code: "revision_conflict" });
    assert.equal(sql.writes, 1);
  });

  it("distinguishes absence from an existing empty document and retries first insert conflicts", async () => {
    assert.notEqual((await snapshotFromRaw(null)).revision, (await snapshotFromRaw("{}")).revision);
    const sql = memorySql(null, (db) => { if (db.writes === 1) db.raw = '{"2_collected":{"other":true}}'; });
    await createPostgresStore(sql, "synthetic").mutate((data) => setByPath(data, "1_declarative.x", 1));
    assert.deepEqual(JSON.parse(sql.raw), { "2_collected": { other: true }, "1_declarative": { x: 1 } });
    assert.equal(sql.writes, 2);
  });

  it("bounds retries and validates revisions before storage access", async () => {
    const sql = memorySql("{}", (db) => { db.raw = JSON.stringify({ concurrent: db.writes }); });
    const store = createPostgresStore(sql, "synthetic");
    await assert.rejects(store.mutate((data) => { data.x = 1; }), { code: "revision_conflict" });
    assert.equal(sql.writes, 3);
    for (const revision of [null, "", 1, {}, "v1:" + "A".repeat(64)]) {
      await assert.rejects(store.mutate(() => assert.fail(), { expectedRevision: revision }), { code: "invalid_revision" });
    }
    assert.equal(sql.writes, 3);
  });

  it("preserves large numbers and JSON-looking strings in untouched fields", async () => {
    const sql = memorySql('{"1_declarative":{},"2_collected":{"large":9007199254740993,"decimal":0.1234567890123456789,"text":"{\\\"a\\\":1}"}}');
    await createPostgresStore(sql, "synthetic").mutate((data) => setByPath(data, "1_declarative.x", true));
    assert.match(sql.raw, /9007199254740993/);
    assert.match(sql.raw, /0\.1234567890123456789/);
    assert.equal(JSON.parse(sql.raw)["2_collected"].text, '{"a":1}');
  });

  it("refuses a path through a losslessly represented number without changing storage", async () => {
    const sql = memorySql('{"1_declarative":{"x":123}}');
    const before = sql.raw;
    await assert.rejects(createPostgresStore(sql, "synthetic").mutate((data) => setByPath(data, "1_declarative.x.y", 1)), /parent is not an object/);
    assert.equal(sql.raw, before);
    assert.equal(sql.writes, 0);
  });

  it("uses content revisions (ABA allowed) and safe explicit schema names", async () => {
    assert.equal((await snapshotFromRaw("{}")).revision, (await snapshotFromRaw("{}")).revision);
    assert.equal(twinTableName(), '"digital_twins"');
    assert.equal(twinTableName("indicators"), '"indicators"."digital_twins"');
    assert.equal(twinTableName("synthetic_schema"), '"synthetic_schema"."digital_twins"');
    for (const schema of ["", "public.digital_twins", 'public"; DROP TABLE x', null]) {
      assert.throws(() => twinTableName(schema), { code: "invalid_storage_config" });
    }
  });

  it("does not retry an uncertain database failure or claim success", async (t) => {
    t.mock.method(console, "error", () => {});
    const sql = memorySql('{}');
    const query = sql.query.bind(sql);
    sql.query = async (text, params) => {
      const result = await query(text, params);
      if (text.startsWith("UPDATE")) throw new Error("synthetic response lost after commit");
      return result;
    };
    await assert.rejects(createPostgresStore(sql, "synthetic").mutate((data) => { data.changed = true; }), {
      code: "storage_error",
    });
    assert.equal(sql.writes, 1);
    assert.equal(JSON.parse(sql.raw).changed, true);
  });
});

describe("file storage across processes", () => {
  it("preserves every independently written path across separate Node processes", async (t) => {
    const { filename, store } = await fixture(t);
    await Promise.all(Array.from({ length: 8 }, (_, index) => child(`
      import { createFileStore } from ${JSON.stringify(storeUrl)};
      const store = createFileStore(process.argv[1]);
      await store.mutate(data => { data["1_declarative"][process.argv[2]] = true; });
    `, [filename, `field${index}`])));
    const snapshot = await store.readSnapshot();
    assert.equal(Object.keys(snapshot.data["1_declarative"]).length, 8);
    assert.deepEqual(snapshot.data["2_collected"], { keep: true });
  });

  it("lets only one strict process commit from the same revision", async (t) => {
    const { filename, store } = await fixture(t);
    const { revision } = await store.readSnapshot();
    const outputs = await Promise.all(["a", "b"].map((field) => child(`
      import { createFileStore } from ${JSON.stringify(storeUrl)};
      try {
        await createFileStore(process.argv[1]).mutate(data => { data["1_declarative"][process.argv[2]] = true; }, { expectedRevision: process.argv[3] });
        console.log("saved");
      } catch (error) { if (error.code !== "revision_conflict") throw error; console.log(error.code); }
    `, [filename, field, revision])));
    assert.deepEqual(outputs.map((s) => s.trim()).sort(), ["revision_conflict", "saved"]);
    assert.equal(Object.keys((await store.readSnapshot()).data["1_declarative"]).length, 1);
  });

  it("fails closed on an old lock and preserves the file after rejected mutation", async (t) => {
    const { filename } = await fixture(t);
    const before = await fs.readFile(filename, "utf8");
    const lockPath = `${filename}.lock`;
    await fs.writeFile(lockPath, "");
    await fs.utimes(lockPath, new Date(0), new Date(0));
    await assert.rejects(createFileStore(filename, { lockTimeoutMs: 30 }).mutate(() => assert.fail()), { code: "storage_locked" });
    assert.equal(await fs.readFile(filename, "utf8"), before);
    await fs.unlink(lockPath);
    await assert.rejects(createFileStore(filename).mutate((data) => { data.changed = true; throw new Error("synthetic refusal"); }), /synthetic refusal/);
    assert.equal(await fs.readFile(filename, "utf8"), before);
    assert.deepEqual(await fs.readdir(path.dirname(filename)), ["twin.json"]);
  });

  it("resolves file aliases to the same lock and keeps exact numeric values", async (t) => {
    const { directory, filename } = await fixture(t);
    await fs.writeFile(filename, '{"1_declarative":{},"large":9007199254740993}');
    const alias = path.join(directory, "alias.json");
    await fs.symlink(filename, alias);
    await Promise.all([filename, alias].map((file, index) => createFileStore(file).mutate((data) => { data["1_declarative"][index] = true; })));
    assert.match(await fs.readFile(filename, "utf8"), /9007199254740993/);
    assert.deepEqual((await createFileStore(filename).readSnapshot()).data["1_declarative"], { 0: true, 1: true });
    assert.equal((await fs.lstat(alias)).isSymbolicLink(), true);
  });

  it("does not write or remove a replacement lock when ownership changes", async (t) => {
    const { filename, store } = await fixture(t);
    const before = await fs.readFile(filename, "utf8");
    await assert.rejects(store.mutate((data) => {
      renameSync(`${filename}.lock`, `${filename}.retired-lock`);
      writeFileSync(`${filename}.lock`, "replacement-owner");
      data.changed = true;
    }), { code: "storage_lock_lost" });
    assert.equal(await fs.readFile(filename, "utf8"), before);
    assert.equal(await fs.readFile(`${filename}.lock`, "utf8"), "replacement-owner");
  });

  it("keeps the original file after a killed owner and refuses automatic stale takeover", async (t) => {
    const { filename } = await fixture(t);
    const before = await fs.readFile(filename, "utf8");
    await assert.rejects(child(`
      import { createFileStore } from ${JSON.stringify(storeUrl)};
      await createFileStore(process.argv[1]).mutate(data => { data.changed = true; process.kill(process.pid, "SIGKILL"); });
    `, [filename]), /SIGKILL/);
    assert.equal(await fs.readFile(filename, "utf8"), before);
    await assert.rejects(createFileStore(filename, { lockTimeoutMs: 20 }).mutate(() => assert.fail()), { code: "storage_locked" });
    assert.equal(await fs.readFile(filename, "utf8"), before);
  });

  it("reports an uncertain outcome after rename if directory fsync fails, without retry", async (t) => {
    const { directory, filename, store } = await fixture(t);
    const realDirectory = await fs.realpath(directory);
    const originalOpen = fs.open.bind(fs);
    t.mock.method(console, "error", () => {});
    t.mock.method(fs, "open", async (file, ...options) => {
      const handle = await originalOpen(file, ...options);
      if (file === realDirectory) handle.sync = async () => { throw Object.assign(new Error("synthetic I/O failure"), { code: "EIO" }); };
      return handle;
    });
    let mutations = 0;
    await assert.rejects(store.mutate((data) => { mutations++; data.changed = true; }), { code: "storage_outcome_unknown" });
    assert.equal(mutations, 1);
    assert.equal(JSON.parse(await fs.readFile(filename, "utf8")).changed, true);
    assert.deepEqual(await fs.readdir(directory), ["twin.json"]);
  });
});
