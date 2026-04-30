/**
 * Archived tests for pre-4type projection layer (profile-calculator.js, mapping.js)
 * Removed from src/tools.test.js as part of WP-218 Ф6.
 * These tests are kept here for reference; they require the archived modules to run.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { calculateProfile, detectStep, calculateConfidence, generateDebugReport, detectDrifts } from "./profile-calculator.js";
import { ProfileCache } from "../../src/cache.js";
import { MAPPING_VERSION, STAGE_CODES } from "./mapping.js";

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
