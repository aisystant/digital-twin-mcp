/**
 * Unit tests for Digital Twin MCP tools
 * Run: npm test
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const METAMODEL_PATH = path.join(__dirname, "..", "metamodel");

// ============ Helper Functions ============

function normalizePath(p) {
  return p.replace(/\//g, ".").replace(/^\.+|\.+$/g, "");
}

function getByPath(obj, pathStr) {
  const parts = normalizePath(pathStr).split(".");
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

function setByPath(obj, pathStr, value) {
  const parts = normalizePath(pathStr).split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function parseMdFile(content, filename) {
  const lines = content.split("\n");
  const result = {
    name: filename,
    type: "unknown",
    format: "unknown",
    description: "",
  };

  for (const line of lines) {
    if (line.startsWith("**Name:**")) {
      result.name = line.replace("**Name:**", "").trim();
    }
    if (line.startsWith("**Type:**")) {
      result.type = line.replace("**Type:**", "").trim();
    }
    if (line.startsWith("**Format:**")) {
      result.format = line.replace("**Format:**", "").trim();
    }
    if (line.startsWith("**Description:**")) {
      result.description = line.replace("**Description:**", "").trim();
    }
  }

  return result;
}

// ============ Tool Functions ============

async function describeByPath(pathArg) {
  if (!pathArg || pathArg === "/" || pathArg === ".") {
    const entries = await fs.readdir(METAMODEL_PATH, { withFileTypes: true });
    const results = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(`${entry.name.replace(".md", "")}:document:Root metamodel document`);
      }
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const groupMdPath = path.join(METAMODEL_PATH, entry.name, "_group.md");
        try {
          const content = await fs.readFile(groupMdPath, "utf-8");
          const firstLine = content.split("\n").find((l) => l.startsWith("# "));
          const desc = firstLine ? firstLine.replace("# ", "").trim() : entry.name;
          results.push(`${entry.name}:group:${desc}`);
        } catch {
          results.push(`${entry.name}:group:`);
        }
      }
    }

    return results.join("\n");
  }

  // For metamodel paths, use slash as separator (folder names can contain dots)
  const targetPath = path.join(METAMODEL_PATH, pathArg.replace(/\//g, path.sep));

  try {
    const stat = await fs.stat(targetPath);

    if (stat.isDirectory()) {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const results = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "_group.md") {
          const name = entry.name.replace(".md", "");
          const content = await fs.readFile(path.join(targetPath, entry.name), "utf-8");
          const { type, format, description } = parseMdFile(content, name);
          results.push(`${name}:${type}/${format}:${description}`);
        }
      }

      return results.join("\n");
    } else {
      const content = await fs.readFile(targetPath, "utf-8");
      return content;
    }
  } catch {
    try {
      const mdPath = targetPath + ".md";
      const content = await fs.readFile(mdPath, "utf-8");
      return content;
    } catch {
      return `Error: Path not found: ${pathArg}`;
    }
  }
}

function readDigitalTwin(twinData, pathArg) {
  if (!pathArg || pathArg === "/" || pathArg === ".") {
    return twinData;
  }

  const value = getByPath(twinData, pathArg);
  if (value === undefined) return { error: `Path not found: ${pathArg}` };
  return value;
}

function writeDigitalTwin(twinData, pathArg, value) {
  setByPath(twinData, pathArg, value);
  return { success: true, path: pathArg, value };
}

// ============ Tests ============

describe("Metamodel Structure", () => {
  it("should have stages.md file", async () => {
    const content = await fs.readFile(path.join(METAMODEL_PATH, "stages.md"), "utf-8");
    assert.ok(content.includes("Stages"), "Should have stages content");
  });

  it("should have degrees.md file", async () => {
    const content = await fs.readFile(path.join(METAMODEL_PATH, "degrees.md"), "utf-8");
    assert.ok(content.includes("Degrees"), "Should have degrees content");
  });

  it("should have group folders", async () => {
    const entries = await fs.readdir(METAMODEL_PATH, { withFileTypes: true });
    const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    assert.ok(folders.includes("01.preferences"), "Should have preferences folder");
    assert.ok(folders.includes("02.agency"), "Should have agency folder");
  });

  it("should have indicators in preference group", async () => {
    const prefPath = path.join(METAMODEL_PATH, "01.preferences");
    const entries = await fs.readdir(prefPath);
    const mdFiles = entries.filter((e) => e.endsWith(".md") && e !== "_group.md");
    assert.ok(mdFiles.length > 0, "Should have indicator files");
    assert.ok(mdFiles.includes("objective.md"), "Should have objective indicator");
  });
});

describe("describe_by_path", () => {
  it("should list all groups at root path", async () => {
    const result = await describeByPath("/");
    assert.ok(result.includes("stages:document"), "Should list stages");
    assert.ok(result.includes("degrees:document"), "Should list degrees");
    assert.ok(result.includes("01.preferences:group"), "Should list preferences group");
  });

  it("should list indicators in a group", async () => {
    // Use the full folder name as path (folder names contain dots)
    const result = await describeByPath("01.preferences");
    assert.ok(result.includes("objective:"), "Should list objective indicator");
    assert.ok(result.includes("role_set:"), "Should list role_set indicator");
  });

  it("should return indicator content", async () => {
    // Use slash to separate folder from indicator
    const result = await describeByPath("01.preferences/objective");
    assert.ok(result.includes("IND.1.PREF.objective"), "Should have indicator code");
    assert.ok(result.includes("**Name:**"), "Should have name field");
    assert.ok(result.includes("**Type:**"), "Should have type field");
  });

  it("should return error for unknown path", async () => {
    const result = await describeByPath("unknown_folder");
    assert.ok(result.includes("Error:"), "Should return error");
  });
});

describe("read_digital_twin", () => {
  const testData = {
    indicators: {
      agency: {
        role_set: ["developer", "learner"],
        goals: ["Learn TypeScript"],
      },
    },
    stage: "STG.Student.Practicing",
  };

  it("should return all data for root path", () => {
    const result = readDigitalTwin(testData, "/");
    assert.deepEqual(result, testData);
  });

  it("should return nested data", () => {
    const result = readDigitalTwin(testData, "indicators.agency.role_set");
    assert.deepEqual(result, ["developer", "learner"]);
  });

  it("should work with slash paths", () => {
    const result = readDigitalTwin(testData, "indicators/agency/goals");
    assert.deepEqual(result, ["Learn TypeScript"]);
  });

  it("should return error for unknown path", () => {
    const result = readDigitalTwin(testData, "unknown.path");
    assert.ok(result.error, "Should have error");
  });
});

describe("write_digital_twin", () => {
  it("should write data to path", () => {
    const data = { indicators: {} };
    const result = writeDigitalTwin(data, "indicators.agency.role_set", ["tester"]);
    assert.ok(result.success);
    assert.deepEqual(data.indicators.agency.role_set, ["tester"]);
  });

  it("should create nested paths", () => {
    const data = {};
    writeDigitalTwin(data, "a.b.c.d", "value");
    assert.equal(data.a.b.c.d, "value");
  });
});

describe("Path helpers", () => {
  it("should normalize paths with slashes", () => {
    assert.equal(normalizePath("a/b/c"), "a.b.c");
    assert.equal(normalizePath("a.b.c"), "a.b.c");
  });

  it("should get value by path", () => {
    const obj = { a: { b: { c: 42 } } };
    assert.equal(getByPath(obj, "a.b.c"), 42);
    assert.equal(getByPath(obj, "a/b/c"), 42);
  });

  it("should set value by path", () => {
    const obj = { a: {} };
    setByPath(obj, "a.b.c", 42);
    assert.equal(obj.a.b.c, 42);
  });

  it("should create nested objects when setting", () => {
    const obj = {};
    setByPath(obj, "x.y.z", "value");
    assert.equal(obj.x.y.z, "value");
  });
});

describe("MD file parsing", () => {
  it("should parse indicator metadata", async () => {
    const content = await fs.readFile(
      path.join(METAMODEL_PATH, "01.preferences", "objective.md"),
      "utf-8"
    );
    const parsed = parseMdFile(content, "objective");
    assert.ok(parsed.name, "Should have name");
    assert.ok(parsed.type, "Should have type");
    assert.ok(parsed.format, "Should have format");
  });
});
