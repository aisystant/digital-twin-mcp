/**
 * In-memory cache with TTL for profile projections.
 * Single-process MCP server — no need for Redis.
 *
 * Invalidation: call invalidate(userId) on write_digital_twin.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class ProfileCache {
  constructor(ttlMs = DEFAULT_TTL_MS) {
    this._store = new Map();
    this._ttlMs = ttlMs;
  }

  /**
   * @param {string} userId
   * @param {number} step
   * @returns {{ data: object, hit: boolean } | null}
   */
  get(userId, step) {
    const key = `${userId}:${step}`;
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this._store.delete(key);
      return null;
    }
    return { data: entry.data, hit: true };
  }

  /**
   * @param {string} userId
   * @param {number} step
   * @param {object} data
   */
  set(userId, step, data) {
    const key = `${userId}:${step}`;
    this._store.set(key, {
      data,
      expires: Date.now() + this._ttlMs,
    });
  }

  /**
   * Invalidate all entries for a user (called on write_digital_twin)
   * @param {string} userId
   */
  invalidate(userId) {
    for (const key of this._store.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this._store.delete(key);
      }
    }
  }

  /** For testing */
  clear() {
    this._store.clear();
  }

  get size() {
    return this._store.size;
  }
}
