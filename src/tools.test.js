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
import { calculateProfile, detectStep, calculateConfidence, generateDebugReport, detectDrifts } from "./profile-calculator.js";
import { ProfileCache } from "./cache.js";
import { MAPPING_VERSION, STAGE_CODES } from "./mapping.js";

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

// Access control
const ACCESS_CONTROL = {
  "1_declarative": { user: "rw", guide: "r", system: "rw" },
  "2_collected": { user: "r", guide: "r", system: "w" },
  "3_derived": { user: "r", guide: "r", system: "w" },
  "4_generated": { user: "r", guide: "rg", system: "g" },
};

function canUserWrite(pathStr) {
  const category = pathStr.split("/")[0].split(".")[0];
  const access = ACCESS_CONTROL[category];
  if (!access) return true;
  return access.user.includes("w");
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

function writeDigitalTwin(twinData, pathArg, value, role = "user") {
  if (!canUserWrite(pathArg) && role === "user") {
    return { error: `Access denied: users cannot write to ${pathArg.split("/")[0]}` };
  }
  setByPath(twinData, pathArg, value);
  return { success: true, path: pathArg, value };
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
  it("should allow user to write to 1_declarative paths", () => {
    const data = {};
    const result = writeDigitalTwin(data, "1_declarative/goals/learning", "test", "user");
    assert.ok(result.success, "Should succeed for 1_declarative");
  });

  it("should deny user write to 2_collected paths", () => {
    const data = {};
    const result = writeDigitalTwin(data, "2_collected/time/total", 100, "user");
    assert.ok(result.error, "Should have error for 2_collected");
    assert.ok(result.error.includes("Access denied"), "Should be access denied");
  });

  it("should deny user write to 3_derived paths", () => {
    const data = {};
    const result = writeDigitalTwin(data, "3_derived/agency/index", 0.8, "user");
    assert.ok(result.error, "Should have error for 3_derived");
  });

  it("should allow system to write anywhere", () => {
    const data = {};
    const result = writeDigitalTwin(data, "3_derived/agency/index", 0.8, "system");
    assert.ok(result.success, "System should be able to write anywhere");
  });

  it("should create nested paths", () => {
    const data = {};
    writeDigitalTwin(data, "a.b.c.d", "value", "user");
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
      path.join(METAMODEL_PATH, "1_declarative", "1_2_goals", "09_Цели обучения.md"),
      "utf-8"
    );
    const parsed = parseMdFile(content, "09_Цели обучения");
    assert.ok(parsed.name, "Should have name");
    assert.ok(parsed.type, "Should have type");
    assert.ok(parsed.format, "Should have format");
  });
});

describe("Access control matrix", () => {
  it("should allow user write to 1_declarative", () => {
    assert.ok(canUserWrite("1_declarative/goals"), "User should write to 1_declarative");
  });

  it("should deny user write to 2_collected", () => {
    assert.ok(!canUserWrite("2_collected/time"), "User should not write to 2_collected");
  });

  it("should deny user write to 3_derived", () => {
    assert.ok(!canUserWrite("3_derived/agency"), "User should not write to 3_derived");
  });

  it("should deny user write to 4_generated", () => {
    assert.ok(!canUserWrite("4_generated/recommendations"), "User should not write to 4_generated");
  });
});

// ============ Profile Calculator Tests ============

// Fixture: twin data with some indicators populated
const TWIN_FIXTURE = {
  indicators: {
    stage: { current: "STG.Student.Practicing" },
    metrics: {
      "IND.3.2.04": 0.3,   // Развитие мировоззрения
      "IND.3.3.04": 0.4,   // Текущие мемы
      "IND.3.3.05": 0.5,   // Калибр личности
      "IND.3.2.01": 0.5,   // Интенсивность практики
      "IND.3.2.05": 0.6,   // Трансформация привычек
      "IND.3.9.01": 0.2,   // Качество взаимодействия с ИИ
      "IND.3.2.02": 0.3,   // Индекс продуктов
      "IND.3.2.03": 0.7,   // Учтённое время
      "IND.3.1.04": 0.8,   // Частота срывов (inverted: high = few failures)
      "IND.3.6.04": 0.4,   // Управление состоянием
      "IND.3.6.01": 0.6,   // Индекс ресурсности
      "IND.3.6.02": 0.5,   // Ритм работа-отдых
      "IND.3.6.03": 0.4,   // Устойчивость
    },
  },
};

describe("detectStep", () => {
  it("should detect step from stage code", () => {
    assert.equal(detectStep(TWIN_FIXTURE), 2);
  });

  it("should return null for missing stage", () => {
    assert.equal(detectStep({ indicators: {} }), null);
    assert.equal(detectStep({}), null);
  });

  it("should handle all known stage codes", () => {
    for (const [code, step] of Object.entries(STAGE_CODES)) {
      const data = { indicators: { stage: { current: code } } };
      assert.equal(detectStep(data), step, `${code} should map to step ${step}`);
    }
  });
});

describe("calculateProfile", () => {
  it("should return correct structure", () => {
    const profile = calculateProfile(TWIN_FIXTURE, 2, "test-user");

    assert.equal(profile.user_id, "test-user");
    assert.equal(profile.step, 2);
    assert.equal(profile.step_name, "Практикующий");
    assert.equal(profile.mapping_version, MAPPING_VERSION);
    assert.ok(profile.timestamp);
    assert.equal(profile.areas.length, 5);
    assert.ok(profile.max_gap);
    assert.ok(profile.transition);
  });

  it("should have 5 areas with correct keys", () => {
    const profile = calculateProfile(TWIN_FIXTURE, 2, "test-user");
    const areaKeys = profile.areas.map(a => a.area);
    assert.deepEqual(areaKeys, ["knowledge", "tools", "constraints", "environment", "organism"]);
  });

  it("should mark leading areas for step 2 (tools, constraints)", () => {
    const profile = calculateProfile(TWIN_FIXTURE, 2, "test-user");
    const leading = profile.areas.filter(a => a.role === "leading").map(a => a.area);
    assert.deepEqual(leading, ["tools", "constraints"]);
  });

  it("should calculate worldview and mastery scores", () => {
    const profile = calculateProfile(TWIN_FIXTURE, 2, "test-user");
    const knowledge = profile.areas.find(a => a.area === "knowledge");

    // knowledge worldview: (0.3*1.0 + 0.4*1.0) / (1.0+1.0) = 0.7/2.0 = 0.35
    assert.equal(knowledge.worldview.score, 0.35);
    // knowledge is supporting for step 2, norm = 0.45
    assert.equal(knowledge.worldview.norm, 0.45);
    assert.equal(knowledge.worldview.gap, 0.1);

    // knowledge mastery: (0.5*1.0 + 0.6*1.0) / 2.0 = 0.55
    assert.equal(knowledge.mastery.score, 0.55);
  });

  it("should include source_indicators with values", () => {
    const profile = calculateProfile(TWIN_FIXTURE, 2, "test-user");
    const knowledge = profile.areas.find(a => a.area === "knowledge");

    assert.equal(knowledge.worldview.source_indicators.length, 2);
    const first = knowledge.worldview.source_indicators[0];
    assert.equal(first.id, "IND.3.2.04");
    assert.equal(first.value, 0.3);
    assert.equal(first.weight, 1.0);
  });

  it("should find max_gap correctly", () => {
    const profile = calculateProfile(TWIN_FIXTURE, 2, "test-user");
    assert.ok(profile.max_gap.area);
    assert.ok(profile.max_gap.dimension);
    assert.ok(typeof profile.max_gap.gap === "number");
  });

  it("should return transition info", () => {
    const profile = calculateProfile(TWIN_FIXTURE, 2, "test-user");
    assert.equal(profile.transition.from, 2);
    assert.equal(profile.transition.to, 3);
    assert.deepEqual(profile.transition.leading_areas, ["tools", "constraints"]);
    assert.ok(profile.transition.key_shift.includes("Пробую"));
  });

  it("should return null transition for step 5", () => {
    const profile = calculateProfile(TWIN_FIXTURE, 5, "test-user");
    assert.equal(profile.transition, null);
  });

  it("should handle missing indicators gracefully", () => {
    const sparse = { indicators: { stage: { current: "STG.Student.Random" }, metrics: {} } };
    const profile = calculateProfile(sparse, 1, "test-user");

    assert.equal(profile.areas.length, 5);
    // All scores should be null (no data)
    for (const area of profile.areas) {
      assert.equal(area.worldview.score, null);
      assert.equal(area.mastery.score, null);
      assert.equal(area.worldview.gap, null);
    }
    assert.equal(profile.max_gap.area, null);
  });
});

describe("calculateConfidence", () => {
  it("should return 0 for null value", () => {
    assert.equal(calculateConfidence(null, { measurement_count: 5, last_measured: "2026-03-28" }), 0);
  });

  it("should return high confidence for recent frequent measurements", () => {
    const now = new Date("2026-03-28");
    const conf = calculateConfidence(0.5, { measurement_count: 10, last_measured: "2026-03-27" }, now);
    assert.ok(conf > 0.9, `Expected >0.9, got ${conf}`);
  });

  it("should decay with time", () => {
    const now = new Date("2026-03-28");
    const recent = calculateConfidence(0.5, { measurement_count: 5, last_measured: "2026-03-25" }, now);
    const old = calculateConfidence(0.5, { measurement_count: 5, last_measured: "2025-12-01" }, now);
    assert.ok(recent > old, `Recent ${recent} should be > old ${old}`);
  });

  it("should increase with measurement count", () => {
    const now = new Date("2026-03-28");
    const few = calculateConfidence(0.5, { measurement_count: 1, last_measured: "2026-03-28" }, now);
    const many = calculateConfidence(0.5, { measurement_count: 10, last_measured: "2026-03-28" }, now);
    assert.ok(many > few, `Many ${many} should be > few ${few}`);
  });

  it("should handle missing meta gracefully", () => {
    const conf = calculateConfidence(0.5, { measurement_count: 0, last_measured: null });
    assert.ok(conf >= 0 && conf <= 1);
  });
});

describe("confidence in profile", () => {
  it("should include confidence in source_indicators", () => {
    const profile = calculateProfile(TWIN_FIXTURE, 2, "test-user");
    const knowledge = profile.areas.find(a => a.area === "knowledge");
    const firstInd = knowledge.worldview.source_indicators[0];
    assert.ok("confidence" in firstInd, "Should have confidence field");
    assert.ok(typeof firstInd.confidence === "number");
  });

  it("should include dimension-level confidence", () => {
    const profile = calculateProfile(TWIN_FIXTURE, 2, "test-user");
    const knowledge = profile.areas.find(a => a.area === "knowledge");
    assert.ok("confidence" in knowledge.worldview, "Dimension should have confidence");
  });

  it("should have higher confidence with metrics_meta", () => {
    const twinWithMeta = {
      ...TWIN_FIXTURE,
      indicators: {
        ...TWIN_FIXTURE.indicators,
        metrics_meta: {
          "IND.3.2.04": { last_measured: "2026-03-27", measurement_count: 10 },
        },
      },
    };
    const profile = calculateProfile(twinWithMeta, 2, "test-user");
    const knowledge = profile.areas.find(a => a.area === "knowledge");
    const ind = knowledge.worldview.source_indicators.find(s => s.id === "IND.3.2.04");
    assert.ok(ind.confidence > 0.5, `Expected >0.5, got ${ind.confidence}`);
  });
});

describe("prerequisite filter", () => {
  it("should mark areas with blocked prerequisites", () => {
    // tools depends on knowledge. If knowledge has big gap → tools blocked
    const twinLowKnowledge = {
      indicators: {
        stage: { current: "STG.Student.Practicing" },
        metrics: {
          "IND.3.2.04": 0.1, // low knowledge worldview
          "IND.3.3.04": 0.1,
          "IND.3.2.01": 0.1,
          "IND.3.2.05": 0.1,
          "IND.3.9.01": 0.8, // high tools worldview
          "IND.3.2.02": 0.8,
          "IND.3.2.03": 0.8,
        },
        metrics_meta: {
          "IND.3.2.04": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.3.04": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.2.01": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.2.05": { last_measured: "2026-03-27", measurement_count: 5 },
        },
      },
    };
    const profile = calculateProfile(twinLowKnowledge, 2, "test-user");
    const tools = profile.areas.find(a => a.area === "tools");
    assert.equal(tools.blocked, true, "Tools should be blocked (knowledge prerequisite has gap)");
    assert.ok(tools.blocked_by.length > 0, "Should list blockers");
  });

  it("should not block areas with no prerequisites", () => {
    const profile = calculateProfile(TWIN_FIXTURE, 2, "test-user");
    const organism = profile.areas.find(a => a.area === "organism");
    assert.equal(organism.blocked, false, "Organism has no prerequisites");
  });

  it("should prefer non-blocked areas for max_gap", () => {
    // Create scenario where blocked area has bigger gap than non-blocked
    const twinBlocked = {
      indicators: {
        stage: { current: "STG.Student.Practicing" },
        metrics: {
          "IND.3.2.04": 0.05,  // knowledge very low → big gap
          "IND.3.3.04": 0.05,
          "IND.3.2.01": 0.05,
          "IND.3.2.05": 0.05,
          "IND.3.9.01": 0.05,  // tools very low → bigger gap, but blocked by knowledge
          "IND.3.2.02": 0.05,
          "IND.3.2.03": 0.05,
          "IND.3.6.01": 0.3,   // organism moderate gap, not blocked
          "IND.3.6.02": 0.3,
          "IND.3.6.03": 0.3,
        },
        metrics_meta: {
          "IND.3.2.04": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.3.04": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.2.01": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.2.05": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.9.01": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.2.02": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.2.03": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.6.01": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.6.02": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.6.03": { last_measured: "2026-03-27", measurement_count: 5 },
        },
      },
    };
    const profile = calculateProfile(twinBlocked, 2, "test-user");
    // max_gap should be non-blocked area (knowledge or organism), not tools
    assert.equal(profile.max_gap.blocked, false, "max_gap should prefer non-blocked area");
    assert.notEqual(profile.max_gap.area, "tools", "Tools is blocked, should not be max_gap");
  });
});

describe("generateDebugReport", () => {
  it("should generate readable text with areas table", () => {
    const profile = calculateProfile(TWIN_FIXTURE, 2, "test-user");
    const report = generateDebugReport(profile);
    assert.ok(report.includes("Профиль развития"), "Should have title");
    assert.ok(report.includes("Знания"), "Should list areas");
    assert.ok(report.includes("Рекомендация"), "Should have recommendation");
    assert.ok(report.includes("Ступень: 2"), "Should show step");
  });

  it("should list null indicators", () => {
    const sparse = { indicators: { stage: { current: "STG.Student.Random" }, metrics: {} } };
    const profile = calculateProfile(sparse, 1, "test-user");
    const report = generateDebugReport(profile);
    assert.ok(report.includes("Отсутствующие данные"), "Should warn about nulls");
  });

  it("should show blocked areas", () => {
    const twinLow = {
      indicators: {
        stage: { current: "STG.Student.Practicing" },
        metrics: { "IND.3.2.04": 0.1, "IND.3.3.04": 0.1, "IND.3.2.01": 0.1, "IND.3.2.05": 0.1 },
        metrics_meta: {
          "IND.3.2.04": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.3.04": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.2.01": { last_measured: "2026-03-27", measurement_count: 5 },
          "IND.3.2.05": { last_measured: "2026-03-27", measurement_count: 5 },
        },
      },
    };
    const profile = calculateProfile(twinLow, 2, "test-user");
    const report = generateDebugReport(profile);
    assert.ok(report.includes("YES:"), "Should show blocked areas");
  });
});

describe("detectDrifts", () => {
  it("should detect no drifts for normal profile", () => {
    // Step 2, scores in normal range
    const twin = {
      indicators: {
        stage: { current: "STG.Student.Practicing" },
        metrics: {
          "IND.3.2.04": 0.3, "IND.3.3.04": 0.3, "IND.3.2.01": 0.3, "IND.3.2.05": 0.3,
          "IND.3.6.01": 0.4, "IND.3.6.02": 0.4, "IND.3.6.03": 0.4,
        },
      },
    };
    const profile = calculateProfile(twin, 2, "test-user");
    const drifts = detectDrifts(profile);
    assert.equal(drifts.length, 0, "No drifts expected for normal range");
  });

  it("should detect drift for anomalous score", () => {
    // Step 1 (Random) but organism score = 0.9 (way above expected [0.1, 0.4])
    const twin = {
      indicators: {
        stage: { current: "STG.Student.Random" },
        metrics: { "IND.3.6.01": 0.95 },
      },
    };
    const profile = calculateProfile(twin, 1, "test-user");
    const drifts = detectDrifts(profile);
    assert.ok(drifts.length > 0, "Should detect drift");
    assert.ok(drifts.some(d => d.area === "organism"), "Drift should be in organism");
  });
});

describe("ProfileCache", () => {
  it("should cache and retrieve profiles", () => {
    const cache = new ProfileCache();
    const data = { step: 2, areas: [] };
    cache.set("user1", 2, data);

    const result = cache.get("user1", 2);
    assert.ok(result);
    assert.equal(result.hit, true);
    assert.deepEqual(result.data, data);
  });

  it("should return null for cache miss", () => {
    const cache = new ProfileCache();
    assert.equal(cache.get("user1", 2), null);
  });

  it("should expire after TTL", () => {
    const cache = new ProfileCache(1); // 1ms TTL
    cache.set("user1", 2, { test: true });

    // Wait for expiry
    const start = Date.now();
    while (Date.now() - start < 5) {} // busy wait 5ms

    assert.equal(cache.get("user1", 2), null);
  });

  it("should invalidate by user_id", () => {
    const cache = new ProfileCache();
    cache.set("user1", 1, { step: 1 });
    cache.set("user1", 2, { step: 2 });
    cache.set("user2", 1, { step: 1 });

    cache.invalidate("user1");

    assert.equal(cache.get("user1", 1), null);
    assert.equal(cache.get("user1", 2), null);
    assert.ok(cache.get("user2", 1)); // user2 untouched
  });

  it("should clear all entries", () => {
    const cache = new ProfileCache();
    cache.set("a", 1, {});
    cache.set("b", 2, {});
    cache.clear();
    assert.equal(cache.size, 0);
  });
});
