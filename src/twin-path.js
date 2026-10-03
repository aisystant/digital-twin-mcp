const CATEGORIES = new Set([
  "1_declarative",
  "2_collected",
  "3_derived",
  "4_generated",
]);
const UNSAFE_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

class TwinPathError extends Error {}

export function normalizePath(pathStr) {
  return pathStr.replace(/\//g, ".").replace(/^\.+|\.+$/g, "");
}

function writePathParts(pathStr) {
  if (typeof pathStr !== "string" || /[\\\u0000-\u001f\u007f]/.test(pathStr)) {
    throw new TwinPathError("Invalid write path: use dot or slash notation");
  }
  const parts = normalizePath(pathStr).split(".");
  if (parts.some((part) => !part.trim() || part !== part.trim())) {
    throw new TwinPathError("Invalid write path: a non-empty path is required");
  }
  if (parts.some((part) => UNSAFE_SEGMENTS.has(part))) {
    throw new TwinPathError("Invalid write path: prototype properties are forbidden");
  }
  if (!CATEGORIES.has(parts[0])) {
    throw new TwinPathError("Invalid write path: unknown category");
  }
  return parts;
}

function userWritePath(pathStr, accessControl) {
  const parts = writePathParts(pathStr);
  const category = parts[0];
  if (category !== "1_declarative" ||
      !Object.hasOwn(accessControl ?? {}, category) ||
      !accessControl[category]?.user?.includes("w")) {
    throw new TwinPathError(`Access denied: users cannot write to ${category}`);
  }
  return parts.join(".");
}

// Trusted system writers use fixed paths; user-controlled paths must pass
// writeUserTwin below, which checks access before loading any data.
export function setByPath(obj, pathStr, value) {
  const parts = writePathParts(pathStr);
  let current = obj;
  for (let i = 0; i < parts.length; i++) {
    if (current === null || typeof current !== "object") {
      throw new TwinPathError("Invalid write path: parent is not an object");
    }
    const part = parts[i];
    if (i === parts.length - 1 || !Object.hasOwn(current, part)) {
      Object.defineProperty(current, part, {
        value: i === parts.length - 1 ? value : {},
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    current = current[part];
  }
}

export async function writeUserTwin(pathStr, value, { accessControl, readData, writeData }) {
  let normalized;
  try {
    normalized = userWritePath(pathStr, accessControl);
  } catch (error) {
    if (!(error instanceof TwinPathError)) throw error;
    return { error: error.message };
  }

  const data = await readData();
  try {
    setByPath(data, normalized, value);
  } catch (error) {
    if (!(error instanceof TwinPathError)) throw error;
    return { error: error.message };
  }
  const persisted = await writeData(data);
  return { success: true, path: pathStr, value, persisted };
}
