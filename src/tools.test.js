/**
 * Unit tests for Digital Twin MCP tools
 * Run: npm test
 *
 * Structure: 4-type classification (IND.1-4)
 * - 1_declarative: User-editable (IND.1.*)
 * - 2_collected: System-collected (IND.2.*)
 * - 3_derived: Calculated (IND.3.*)
 * - 4_generated: On-demand (IND.4.*)
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { ProfileCache } from "./cache.js";
import { normalizePath, setByPath, writeUserTwin } from "./twin-path.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const METAMODEL_PATH = path.join(__dirname, "..", "metamodel");

// ============ Helper Functions ============

function getByPath(obj, pathStr) {
  const parts = normalizePath(pathStr).split(".");
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

// Access control
const ACCESS_CONTROL = {
  "1_declarative": { user: "rw", guide: "r", system: "rw" },
  "2_collected": { user: "r", guide: "r", system: "w" },
  "3_derived": { user: "r", guide: "r", system: "w" },
  "4_generated": { user: "r", guide: "rg", system: "g" },
};

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

    // _shared files
    const sharedPath = path.join(METAMODEL_PATH, "_shared");
    try {
      const sharedEntries = await fs.readdir(sharedPath, { withFileTypes: true });
      for (const entry of sharedEntries) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          results.push(`${entry.name.replace(".md", "")}:document:Shared`);
        }
      }
    } catch {}

    // Categories
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith("_")) {
        const groupMdPath = path.join(METAMODEL_PATH, entry.name, "_group.md");
        try {
          const content = await fs.readFile(groupMdPath, "utf-8");
          const firstLine = content.split("\n").find((l) => l.startsWith("# "));
          const desc = firstLine ? firstLine.replace("# ", "").trim() : entry.name;
          results.push(`${entry.name}:category:${desc}`);
        } catch {
          results.push(`${entry.name}:category:`);
        }
      }
    }

    return results.join("\n");
  }

  const targetPath = path.join(METAMODEL_PATH, pathArg.replace(/\//g, path.sep));

  try {
    const stat = await fs.stat(targetPath);

    if (stat.isDirectory()) {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const results = [];

      // Subdirectories (subgroups)
      for (const entry of entries) {
        if (entry.isDirectory()) {
          results.push(`${entry.name}:group:`);
        }
      }

      // MD files (indicators)
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
      return await fs.readFile(targetPath, "utf-8");
    }
  } catch {
    try {
      const mdPath = targetPath + ".md";
      return await fs.readFile(mdPath, "utf-8");
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
  return writeUserTwin(pathArg, value, {
    accessControl: ACCESS_CONTROL,
    readData: async () => twinData,
    writeData: async () => true,
  });
}

// ============ Tests ============

describe("Metamodel Structure (4-type)", () => {
  it("should have _shared folder with stages.md and degrees.md", async () => {
    const sharedPath = path.join(METAMODEL_PATH, "_shared");
    const entries = await fs.readdir(sharedPath);
    assert.ok(entries.includes("stages.md"), "Should have stages.md");
    assert.ok(entries.includes("degrees.md"), "Should have degrees.md");
  });

  it("should have 4 category folders", async () => {
    const entries = await fs.readdir(METAMODEL_PATH, { withFileTypes: true });
    const categories = entries.filter((e) => e.isDirectory() && !e.name.startsWith("_")).map((e) => e.name);
    assert.ok(categories.includes("1_declarative"), "Should have 1_declarative");
    assert.ok(categories.includes("2_collected"), "Should have 2_collected");
    assert.ok(categories.includes("3_derived"), "Should have 3_derived");
    assert.ok(categories.includes("4_generated"), "Should have 4_generated");
  });

  it("should have subgroups in 1_declarative", async () => {
    const declPath = path.join(METAMODEL_PATH, "1_declarative");
    const entries = await fs.readdir(declPath, { withFileTypes: true });
    const subgroups = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    assert.ok(subgroups.includes("1_2_goals"), "Should have 1_2_goals");
    assert.ok(subgroups.includes("1_3_selfeval"), "Should have 1_3_selfeval");
  });

  it("should have indicators in 1_declarative/1_2_goals", async () => {
    const goalsPath = path.join(METAMODEL_PATH, "1_declarative", "1_2_goals");
    const entries = await fs.readdir(goalsPath);
    const mdFiles = entries.filter((e) => e.endsWith(".md") && e !== "_group.md");
    assert.ok(mdFiles.length > 0, "Should have indicator files");
    assert.ok(mdFiles.some(f => f.includes("Цели обучения")), "Should have learning goals indicator");
  });
});

describe("describe_by_path (4-type)", () => {
  it("should list categories at root path", async () => {
    const result = await describeByPath("/");
    assert.ok(result.includes("1_declarative:category"), "Should list 1_declarative");
    assert.ok(result.includes("3_derived:category"), "Should list 3_derived");
    assert.ok(result.includes("stages:document"), "Should list stages");
  });

  it("should list subgroups in a category", async () => {
    const result = await describeByPath("1_declarative");
    assert.ok(result.includes("1_2_goals:group"), "Should list 1_2_goals");
    assert.ok(result.includes("1_3_selfeval:group"), "Should list 1_3_selfeval");
  });

  it("should list indicators in a subgroup", async () => {
    const result = await describeByPath("1_declarative/1_2_goals");
    assert.ok(result.includes("Цели обучения"), "Should list learning goals indicator");
  });

  it("should return indicator content", async () => {
    const result = await describeByPath("1_declarative/1_2_goals/09_Цели обучения");
    assert.ok(result.includes("IND.1.2"), "Should have indicator code");
    assert.ok(result.includes("**Name:**"), "Should have name field");
  });

  it("should return error for unknown path", async () => {
    const result = await describeByPath("unknown_category");
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

describe("write_digital_twin (access control)", () => {
  it("should allow user to write to 1_declarative paths", async () => {
    const data = {};
    const result = await writeDigitalTwin(data, "1_declarative/goals/learning", "test");
    assert.ok(result.success, "Should succeed for 1_declarative");
    assert.equal(data["1_declarative"].goals.learning, "test");
  });

  it("should deny user write to 2_collected paths", async () => {
    const data = {};
    const result = await writeDigitalTwin(data, "2_collected/time/total", 100);
    assert.ok(result.error, "Should have error for 2_collected");
    assert.ok(result.error.includes("Access denied"), "Should be access denied");
    assert.deepEqual(data, {});
  });

  it("should deny user write to 3_derived paths", async () => {
    const data = {};
    const result = await writeDigitalTwin(data, "3_derived/agency/index", 0.8);
    assert.ok(result.error, "Should have error for 3_derived");
    assert.deepEqual(data, {});
  });

  it("should allow a trusted system writer to update its fixed RCS path", () => {
    const data = {};
    setByPath(data, "3_derived/rcs_profile", { agency: 0.8 });
    assert.deepEqual(data, { "3_derived": { rcs_profile: { agency: 0.8 } } });
  });

  it("should create nested declarative paths", async () => {
    const data = {};
    await writeDigitalTwin(data, "1_declarative.a.b.c", "value");
    assert.equal(data["1_declarative"].a.b.c, "value");
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
    const obj = { "1_declarative": {} };
    setByPath(obj, "1_declarative.b.c", 42);
    assert.equal(obj["1_declarative"].b.c, 42);
  });

  it("should create nested objects when setting", () => {
    const obj = {};
    setByPath(obj, "1_declarative.y.z", "value");
    assert.equal(obj["1_declarative"].y.z, "value");
  });
});

describe("MD file parsing", () => {
  it("should parse indicator metadata", async () => {
    const content = await fs.readFile(
      path.join(METAMODEL_PATH, "1_declarative", "1_2_goals", "09_Цели обучения.md"),
      "utf-8"
    );
    const parsed = parseMdFile(content, "09_Цели обучения");
    assert.ok(parsed.name, "Should have name");
    assert.ok(parsed.type, "Should have type");
    assert.ok(parsed.format, "Should have format");
  });
});
