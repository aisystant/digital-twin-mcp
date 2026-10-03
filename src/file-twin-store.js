import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  TwinStoreError, conflict, mutationData, serializeData, snapshotFromRaw, validateRevision,
} from "./twin-store.js";

async function acquireLock(lockPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      return await fs.open(lockPath, "wx", 0o600);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) {
        throw new TwinStoreError("storage_locked", "Twin file is locked; abandoned locks require operator recovery");
      }
      // No TTL takeover: a paused process may still own the critical section.
      await delay(20);
    }
  }
}

async function replaceFile(filename, raw) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  let renamed = false;
  try {
    await fs.writeFile(temporary, raw, { flag: "wx", mode: 0o600, flush: true });
    await fs.rename(temporary, filename);
    renamed = true;
    const directory = await fs.open(path.dirname(filename), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } catch (error) {
    console.error("[twin-store] file persistence failed", { phase: renamed ? "directory_sync" : "replace", code: error.code });
    throw new TwinStoreError(renamed ? "storage_outcome_unknown" : "storage_error",
      renamed ? "Twin file was replaced but durability is uncertain; read before retrying" : "Twin file could not be saved");
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

async function ownsLock(lockPath, owner) {
  try {
    const current = await fs.lstat(lockPath);
    return current.dev === owner.dev && current.ino === owner.ino;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export function createFileStore(filename, { lockTimeoutMs = 2000 } = {}) {
  // Resolve aliases so two stdio processes cannot acquire different locks for one file.
  let target;
  const resolveTarget = () => target ??= fs.realpath(filename);

  async function readSnapshot() {
    return snapshotFromRaw(await fs.readFile(await resolveTarget(), "utf8"));
  }

  async function mutate(change, { expectedRevision } = {}) {
    validateRevision(expectedRevision);
    const resolved = await resolveTarget();
    const lockPath = `${resolved}.lock`;
    const lock = await acquireLock(lockPath, lockTimeoutMs);
    const owner = await lock.stat();
    try {
      const snapshot = await readSnapshot();
      if (expectedRevision !== undefined && expectedRevision !== snapshot.revision) {
        throw conflict(snapshot.revision);
      }
      const data = mutationData(snapshot);
      const result = change(data);
      const raw = serializeData(data);
      if (!await ownsLock(lockPath, owner)) {
        throw new TwinStoreError("storage_lock_lost", "Twin file lock ownership changed");
      }
      await replaceFile(resolved, raw);
      return { result, revision: (await snapshotFromRaw(raw)).revision, persisted: true };
    } finally {
      try {
        if (await ownsLock(lockPath, owner)) await fs.unlink(lockPath);
        else throw new TwinStoreError("storage_lock_lost", "Twin file lock ownership changed");
      } finally {
        await lock.close();
      }
    }
  }

  return { readSnapshot, mutate };
}
