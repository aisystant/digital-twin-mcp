export const REVISION_PATTERN = "^v1:[a-f0-9]{64}$";

export class TwinStoreError extends Error {
  constructor(code, message, revision) {
    super(message);
    this.name = "TwinStoreError";
    this.code = code;
    this.revision = revision;
  }
}

export function validateRevision(revision) {
  if (revision !== undefined &&
      (typeof revision !== "string" || !new RegExp(REVISION_PATTERN).test(revision))) {
    throw new TwinStoreError("invalid_revision", "expected_revision must be a revision returned by a read");
  }
}

export function conflict(revision) {
  return new TwinStoreError("revision_conflict", "Digital twin changed; read it again before writing", revision);
}

export function storeErrorResult(error) {
  if (!(error instanceof TwinStoreError)) throw error;
  return { error: error.message, code: error.code, ...(error.revision && { current_revision: error.revision }) };
}

export async function snapshotFromRaw(raw) {
  const bytes = new TextEncoder().encode(raw === null ? "absent" : `present\n${raw}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { raw, data: raw === null ? {} : JSON.parse(raw), revision: `v1:${digest}` };
}

// Keep untouched JSON numbers exact, including integers outside JS's safe range.
export function mutationData(snapshot) {
  return snapshot.raw === null ? {} : JSON.parse(snapshot.raw, (_key, value, context) =>
    typeof value === "number" && JSON.stringify(value) !== context.source ? JSON.rawJSON(context.source) : value);
}

export function serializeData(data) {
  const raw = JSON.stringify(data);
  if (raw === undefined) throw new TwinStoreError("invalid_data", "Twin data must be JSON");
  return raw;
}

// Database identifiers are configuration, never request arguments. Values use $n parameters.
export function twinTableName(schema) {
  if (schema === undefined) return '"digital_twins"';
  if (typeof schema !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new TwinStoreError("invalid_storage_config", "Invalid digital twin database schema");
  }
  return `"${schema}"."digital_twins"`;
}

export function createPostgresStore(sql, userId, { schema, ensureTable = false, maxAttempts = 3 } = {}) {
  const table = twinTableName(schema);
  let ready;

  async function query(text, params = []) {
    try {
      return await sql.query(text, params);
    } catch (error) {
      console.error("[twin-store] database request failed", { type: error.name });
      throw new TwinStoreError("storage_error", "Digital twin storage request failed; outcome may be unknown");
    }
  }

  async function initialize() {
    if (!ensureTable) return;
    ready ??= query(`CREATE TABLE IF NOT EXISTS ${table} (
      user_id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await ready;
  }

  async function readSnapshot() {
    await initialize();
    const rows = await query(`SELECT data::text AS raw FROM ${table} WHERE user_id = $1`, [userId]);
    return snapshotFromRaw(rows.length ? rows[0].raw : null);
  }

  async function compareAndSwap(snapshot, raw) {
    const rows = snapshot.raw === null
      ? await query(`INSERT INTO ${table} (user_id, data, updated_at)
          VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (user_id) DO NOTHING RETURNING data::text AS raw`,
        [userId, raw])
      : await query(`UPDATE ${table} SET data = $2::jsonb, updated_at = NOW()
          WHERE user_id = $1 AND data = $3::jsonb RETURNING data::text AS raw`,
        [userId, raw, snapshot.raw]);
    return rows.length ? snapshotFromRaw(rows[0].raw) : null;
  }

  async function mutate(change, { expectedRevision } = {}) {
    validateRevision(expectedRevision);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const snapshot = await readSnapshot();
      if (expectedRevision !== undefined && expectedRevision !== snapshot.revision) {
        throw conflict(snapshot.revision);
      }
      const data = mutationData(snapshot);
      const result = change(data);
      const saved = await compareAndSwap(snapshot, serializeData(data));
      if (saved) return { result, revision: saved.revision, persisted: true };
      if (expectedRevision !== undefined) throw conflict();
    }
    throw conflict();
  }

  return { readSnapshot, mutate };
}
