import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CORE_TOOLS, STDIO_EXTRA_TOOLS, STDIO_TOOLS, SERVER_VERSION } from "./tool-catalog.js";
import { getIndicatorsSchema } from "./utils/db.js";

async function clients(t, initial) {
  const repo = fileURLToPath(new URL("..", import.meta.url));
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dt-contract-test-"));
  const clients = [];
  t.after(async () => {
    await Promise.all(clients.map((client) => client.close()));
    await fs.rm(directory, { recursive: true, force: true });
  });
  await fs.cp(path.join(repo, "src"), path.join(directory, "src"), { recursive: true });
  await fs.copyFile(path.join(repo, "package.json"), path.join(directory, "package.json"));
  await fs.symlink(path.join(repo, "node_modules"), path.join(directory, "node_modules"), "dir");
  await fs.mkdir(path.join(directory, "data"));
  const filename = path.join(directory, "data", "twin.json");
  await fs.writeFile(filename, JSON.stringify(initial));
  for (let i = 0; i < 2; i++) {
    const client = new Client({ name: "synthetic-contract-test", version: "1.0.0" });
    clients.push(client);
    const transport = new StdioClientTransport({
      command: process.execPath, args: [path.join(directory, "src", "index.js")],
      env: { DATABASE_URL: "", DT_USER_ID: "", LEARNING_URL: "" }, stderr: "pipe",
    });
    await client.connect(transport);
    transport.stderr?.resume();
  }
  return { clients, filename };
}

async function call(client, name, args = {}) {
  const response = await client.callTool({ name, arguments: args });
  return { ...response, value: JSON.parse(response.content[0].text) };
}

describe("catalog and opt-in revision contract", () => {
  it("advertises three shared tools plus four explicit local capabilities and one release version", async (t) => {
    const { clients: [client] } = await clients(t, {});
    assert.equal(CORE_TOOLS.length, 3);
    assert.equal(STDIO_EXTRA_TOOLS.length, 4);
    assert.deepEqual((await client.listTools()).tools, STDIO_TOOLS);
    assert.equal(client.getServerVersion().version, SERVER_VERSION);
    assert.equal(getIndicatorsSchema({ INDICATORS_DB_SCHEMA: "synthetic_override" }), "synthetic_override");
    assert.equal(getIndicatorsSchema({}), "indicators");
  });

  it("preserves legacy string/root reads, returns revisions on request and rejects stale writes", async (t) => {
    const initial = { "1_declarative": { existing: true, message: { error: "stored value" } }, "2_collected": { keep: true } };
    const { clients: [client], filename } = await clients(t, initial);
    assert.deepEqual((await call(client, "read_digital_twin", { path: "/" })).value, initial);
    const snapshot = (await call(client, "read_digital_twin", { path: "/", include_revision: true })).value;
    assert.deepEqual(snapshot.data, initial);
    const message = (await call(client, "read_digital_twin", { path: "1_declarative.message", include_revision: true })).value;
    assert.deepEqual(message.data, initial["1_declarative"].message);
    assert.equal(message.revision, snapshot.revision);
    assert.match(snapshot.revision, /^v1:[a-f0-9]{64}$/);
    const saved = await call(client, "write_digital_twin", {
      path: "1_declarative.text", data: '["literal"]', expected_revision: snapshot.revision,
    });
    assert.notEqual(saved.isError, true);
    assert.equal(saved.value.value, '["literal"]');
    assert.notEqual(saved.value.revision, snapshot.revision);
    const before = await fs.readFile(filename, "utf8");
    assert.equal(JSON.parse(before)["1_declarative"].text, '["literal"]');
    const stale = await call(client, "write_digital_twin", {
      path: "1_declarative.blocked", data: true, expected_revision: snapshot.revision,
    });
    assert.equal(stale.isError, true);
    assert.equal(stale.value.code, "revision_conflict");
    assert.equal(await fs.readFile(filename, "utf8"), before);
  });

  it("merges concurrent RCS writers, keeps numeric results and excludes reserved revision metadata", async (t) => {
    const { clients: peers, filename } = await clients(t, {
      "1_declarative": { keep: true }, "3_derived": { rcs_profile: { agency: 0.7, worldview: 3 } },
    });
    const results = await Promise.all([
      call(peers[0], "dt_update_profile_rcs", { agency: 0.8 }),
      call(peers[1], "dt_update_profile_rcs", { worldview: 4 }),
    ]);
    results.forEach((result) => assert.notEqual(result.isError, true));
    const profile = (await call(peers[0], "dt_get_profile_rcs")).value;
    assert.equal(profile.agency, 0.8);
    assert.equal(profile.worldview, 4);
    assert.equal(typeof profile.agency, "number");
    const snapshot = (await call(peers[0], "read_digital_twin", { path: "/", include_revision: true })).value;
    const updated = await call(peers[0], "dt_update_profile_rcs", { source: "synthetic", expected_revision: snapshot.revision });
    assert.notEqual(updated.isError, true);
    assert.equal(Object.hasOwn(updated.value.rcs, "expected_revision"), false);
    const before = await fs.readFile(filename, "utf8");
    for (const tool of ["dt_update_profile_rcs", "dt_snapshot_rcs"]) {
      const stale = await call(peers[1], tool, { expected_revision: snapshot.revision });
      assert.equal(stale.isError, true);
      assert.equal(stale.value.code, "revision_conflict");
      assert.equal(await fs.readFile(filename, "utf8"), before);
    }
    assert.deepEqual(JSON.parse(before)["1_declarative"], { keep: true });
  });

  it("retains concurrent history appends and caps history at 52", async (t) => {
    const history = Array.from({ length: 50 }, (_, index) => ({ timestamp: `old-${index}`, values: { A: 0.1 } }));
    const { clients: peers, filename } = await clients(t, {
      "3_derived": { rcs_profile: { agency: 0.8, worldview: 4 }, rcs_history: history },
    });
    const appended = await Promise.all(peers.map((client) => call(client, "dt_snapshot_rcs")));
    appended.forEach((result) => {
      assert.notEqual(result.isError, true);
      assert.equal(result.value.snapshot.values.A, 0.8);
      assert.equal(typeof result.value.snapshot.values.A, "number");
    });
    let stored = JSON.parse(await fs.readFile(filename, "utf8"))["3_derived"].rcs_history;
    assert.equal(stored.length, 52);
    assert.equal(stored.filter((entry) => !entry.timestamp.startsWith("old-")).length, 2);
    await call(peers[0], "dt_snapshot_rcs");
    stored = JSON.parse(await fs.readFile(filename, "utf8"))["3_derived"].rcs_history;
    assert.equal(stored.length, 52);
    assert.equal(stored[0].timestamp, "old-1");
    assert.equal(stored.filter((entry) => !entry.timestamp.startsWith("old-")).length, 3);
  });
});
