import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPostgresStore, snapshotFromRaw, twinTableName } from "./twin-store.js";
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
