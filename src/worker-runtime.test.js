import { it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { CORE_TOOLS, SERVER_VERSION } from "./tool-catalog.js";

it("executes lossless CAS and the cloud catalog in the Workers runtime", { timeout: 30000 }, async (t) => {
  const result = await build({
    stdin: {
      resolveDir: fileURLToPath(new URL(".", import.meta.url)),
      contents: `
        import worker from "./worker-sse.js";
        import { createPostgresStore } from "./twin-store.js";
        import { setByPath } from "./twin-path.js";
        export default { async fetch(request) {
          if (new URL(request.url).pathname !== "/test-storage") return worker.fetch(request, {});
          let raw = '{"1_declarative":{},"2_collected":{"large":9007199254740993,"decimal":0.1234567890123456789}}';
          const sql = { async query(query, params) {
            if (query.startsWith("UPDATE")) {
              if (raw !== params[2]) return [];
              raw = params[1];
            }
            return [{raw}];
          } };
          const store = createPostgresStore(sql, "synthetic");
          const revision = (await store.readSnapshot()).revision;
          const saved = await store.mutate(data => setByPath(data, "1_declarative.x", 0.8), {expectedRevision: revision});
          let conflict;
          try { await store.mutate(data => setByPath(data, "1_declarative.x", 2), {expectedRevision: revision}); }
          catch (error) { conflict = error.code; }
          return Response.json({raw, saved: saved.persisted, revision: saved.revision, conflict});
        } };
      `,
    },
    bundle: true, write: false, format: "esm", platform: "browser", target: "es2022",
  });
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: result.outputFiles[0].text,
    compatibilityDate: "2024-12-01", cf: false,
  }));
  t.after(() => runtime.dispose());
  const saved = await (await runtime.dispatchFetch("http://localhost/test-storage")).json();
  assert.equal(saved.saved, true);
  assert.equal(saved.conflict, "revision_conflict");
  assert.match(saved.revision, /^v1:[a-f0-9]{64}$/);
  assert.match(saved.raw, /9007199254740993/);
  assert.match(saved.raw, /0\.1234567890123456789/);
  assert.equal(JSON.parse(saved.raw)["1_declarative"].x, 0.8);
  const health = await (await runtime.dispatchFetch("http://localhost/health")).json();
  assert.equal(health.version, SERVER_VERSION);
  const catalog = await (await runtime.dispatchFetch("http://localhost/mcp", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  })).json();
  assert.deepEqual(catalog.result.tools, CORE_TOOLS);
});
