/**
 * Unit tests for Digital Twin MCP tools
 * Run: npm test
 */

import { describe, it } from "node:test";
import assert from "node:assert";

// Import test data
import stages from "./stages.json" with { type: "json" };
import groups from "./groups.json" with { type: "json" };
import indicators from "./indicators.json" with { type: "json" };
import degrees from "./degrees.json" with { type: "json" };

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

// ============ Tool Functions ============

function getDegrees() {
  return degrees;
}

function getStages() {
  return stages;
}

function getIndicatorGroups() {
  return groups;
}

function getIndicators(groupCode, forPrompts, forQualification) {
  let filtered = indicators.indicators;

  if (groupCode) {
    filtered = filtered.filter((ind) => ind.group === groupCode);
  }
  if (forPrompts !== undefined) {
    filtered = filtered.filter((ind) => ind.for_prompts === forPrompts);
  }
  if (forQualification !== undefined) {
    filtered = filtered.filter((ind) => ind.for_qualification === forQualification);
  }

  return {
    ...indicators,
    indicators: filtered,
    count: filtered.length,
  };
}

function getIndicator(code) {
  const indicator = indicators.indicators.find((ind) => ind.code === code);
  if (!indicator) {
    return { error: `Indicator not found: ${code}` };
  }
  return indicator;
}

function getStageThresholds(indicatorCode) {
  const indicator = indicators.indicators.find((ind) => ind.code === indicatorCode);

  if (!indicator) {
    return { error: `Indicator not found: ${indicatorCode}` };
  }

  if (!indicator.thresholds) {
    return {
      indicator: indicatorCode,
      message: "This indicator does not have stage thresholds",
      for_qualification: indicator.for_qualification || false,
    };
  }

  const enrichedThresholds = {};
  for (const [stageCode, threshold] of Object.entries(indicator.thresholds)) {
    const stage = stages.stages.find((s) => s.code === stageCode);
    enrichedThresholds[stageCode] = {
      ...threshold,
      stage_name: stage?.name || stageCode,
      stage_order: stage?.order,
    };
  }

  return {
    indicator: indicatorCode,
    indicator_name: indicator.name,
    unit: indicator.unit,
    thresholds: enrichedThresholds,
  };
}

function validateValue(indicatorCode, value) {
  const indicator = indicators.indicators.find((ind) => ind.code === indicatorCode);

  if (!indicator) {
    return { valid: false, error: `Indicator not found: ${indicatorCode}` };
  }

  const errors = [];

  switch (indicator.format) {
    case "integer":
      if (!Number.isInteger(value)) {
        errors.push(`Expected integer, got ${typeof value}`);
      }
      break;
    case "float":
      if (typeof value !== "number") {
        errors.push(`Expected number, got ${typeof value}`);
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        errors.push(`Expected boolean, got ${typeof value}`);
      }
      break;
    case "string":
    case "structured_text":
      if (typeof value !== "string") {
        errors.push(`Expected string, got ${typeof value}`);
      }
      break;
    case "enum":
      if (indicator.enum_values && !indicator.enum_values.includes(value)) {
        errors.push(`Value must be one of: ${indicator.enum_values.join(", ")}`);
      }
      break;
  }

  if (indicator.min !== undefined && value < indicator.min) {
    errors.push(`Value ${value} is below minimum ${indicator.min}`);
  }
  if (indicator.max !== undefined && value > indicator.max) {
    errors.push(`Value ${value} is above maximum ${indicator.max}`);
  }

  return {
    valid: errors.length === 0,
    indicator: indicatorCode,
    value,
    format: indicator.format,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============ Tests ============

describe("Metamodel Data", () => {
  it("should have valid degrees", () => {
    assert.ok(degrees.degrees.length > 0, "Should have degrees");
    assert.ok(degrees.degrees.find((d) => d.code === "DEG.Student"), "Should have Student degree");
  });

  it("should have valid stages", () => {
    assert.ok(stages.stages.length > 0, "Should have stages");
    assert.ok(stages.stages.find((s) => s.code === "STG.Student.Practicing"), "Should have Practicing stage");
  });

  it("should have valid groups", () => {
    assert.ok(groups.groups.length > 0, "Should have groups");
    assert.ok(groups.groups.find((g) => g.code === "1.PREF"), "Should have preferences group");
  });

  it("should have valid indicators", () => {
    assert.ok(indicators.indicators.length > 0, "Should have indicators");
    assert.ok(
      indicators.indicators.find((i) => i.code === "IND.1.PREF.objective"),
      "Should have objective indicator"
    );
  });
});

describe("get_degrees", () => {
  it("should return all degrees", () => {
    const result = getDegrees();
    assert.ok(result.degrees.length >= 9, "Should have at least 9 degrees");
    assert.equal(result.degrees[0].code, "DEG.Freshman");
  });
});

describe("get_stages", () => {
  it("should return all stages", () => {
    const result = getStages();
    assert.ok(result.stages.length >= 5, "Should have at least 5 stages");
  });

  it("should have period_weeks for stages", () => {
    const result = getStages();
    const practicing = result.stages.find((s) => s.code === "STG.Student.Practicing");
    assert.ok(practicing.period_weeks, "Practicing should have period_weeks");
  });
});

describe("get_indicator_groups", () => {
  it("should return all groups", () => {
    const result = getIndicatorGroups();
    assert.ok(result.groups.length >= 11, "Should have at least 11 groups");
  });

  it("should have preferences and derived groups", () => {
    const result = getIndicatorGroups();
    const pref = result.groups.find((g) => g.code === "1.PREF");
    const derived = result.groups.find((g) => g.code === "2.1");
    assert.ok(pref, "Should have preferences group");
    assert.ok(derived, "Should have derived group 2.1");
  });
});

describe("get_indicators", () => {
  it("should return all indicators without filter", () => {
    const result = getIndicators();
    assert.ok(result.count > 0, "Should have indicators");
    assert.equal(result.indicators.length, result.count);
  });

  it("should filter by group", () => {
    const result = getIndicators("1.PREF");
    assert.ok(result.count > 0, "Should have preference indicators");
    result.indicators.forEach((ind) => {
      assert.equal(ind.group, "1.PREF", "All should be from 1.PREF group");
    });
  });

  it("should filter by for_prompts", () => {
    const result = getIndicators(undefined, true);
    result.indicators.forEach((ind) => {
      assert.equal(ind.for_prompts, true, "All should have for_prompts=true");
    });
  });

  it("should filter by for_qualification", () => {
    const result = getIndicators(undefined, undefined, true);
    result.indicators.forEach((ind) => {
      assert.equal(ind.for_qualification, true, "All should have for_qualification=true");
    });
  });
});

describe("get_indicator", () => {
  it("should return indicator by code", () => {
    const result = getIndicator("IND.1.PREF.objective");
    assert.equal(result.code, "IND.1.PREF.objective");
    assert.ok(result.name, "Should have name");
  });

  it("should return error for unknown code", () => {
    const result = getIndicator("IND.UNKNOWN");
    assert.ok(result.error, "Should have error");
  });
});

describe("get_stage_thresholds", () => {
  it("should return thresholds for indicator with thresholds", () => {
    const result = getStageThresholds("IND.2.1.1");
    assert.equal(result.indicator, "IND.2.1.1");
    assert.ok(result.thresholds, "Should have thresholds");
  });

  it("should return message for indicator without thresholds", () => {
    const result = getStageThresholds("IND.1.PREF.objective");
    assert.ok(result.message, "Should have message about no thresholds");
  });

  it("should return error for unknown indicator", () => {
    const result = getStageThresholds("IND.UNKNOWN");
    assert.ok(result.error, "Should have error");
  });
});

describe("validate_value", () => {
  it("should validate integer values", () => {
    const result = validateValue("IND.1.PREF.weekly_time_budget", 10);
    assert.equal(result.valid, true);
  });

  it("should reject wrong type", () => {
    const result = validateValue("IND.1.PREF.weekly_time_budget", "not a number");
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it("should validate float type", () => {
    const result = validateValue("IND.1.PREF.weekly_time_budget", 15.5);
    assert.equal(result.valid, true);
    assert.equal(result.format, "float");
  });

  it("should return error for unknown indicator", () => {
    const result = validateValue("IND.UNKNOWN", 10);
    assert.equal(result.valid, false);
    assert.ok(result.error);
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
