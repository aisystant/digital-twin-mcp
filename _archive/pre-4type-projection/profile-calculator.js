/**
 * Profile calculator: aggregates ЦД indicators into 5-area GAP profile.
 * Projection Layer (SOTA.012 Multi-Representation).
 *
 * Pure function: twinData + step + mapping → profile response.
 * No side effects, no I/O — easy to test.
 */

import {
  MAPPING_VERSION,
  STAGE_NAMES,
  STAGE_CODES,
  AREAS,
  AREA_MAPPING,
  LEADING_AREAS,
  NORMS,
  KEY_SHIFTS,
  PREREQUISITES,
  BASELINE_PROFILES,
} from "./mapping.js";

/**
 * Resolve indicator value from twin data.
 * The indicator key contains dots but is a single property name in metrics object.
 */
function getIndicatorValue(twinData, indicatorId) {
  const metrics = twinData?.indicators?.metrics;
  if (!metrics) return undefined;
  return metrics[indicatorId];
}

/**
 * Get metadata for an indicator (last_measured, measurement_count).
 * Stored in twinData.indicators.metrics_meta[indicatorId].
 * Returns defaults if not present (backwards compatible).
 */
function getIndicatorMeta(twinData, indicatorId) {
  const meta = twinData?.indicators?.metrics_meta?.[indicatorId];
  return {
    last_measured: meta?.last_measured ?? null,
    measurement_count: meta?.measurement_count ?? 0,
  };
}

/**
 * Calculate confidence for an indicator based on recency and measurement count.
 * confidence = count_factor × recency_factor
 *   count_factor: min(measurement_count / 5, 1.0) — saturates at 5 measurements
 *   recency_factor: exp(-days_since / 90) — half-life ~62 days
 *
 * Returns 0 if no data (value is null), regardless of meta.
 * @returns {number} [0, 1]
 */
export function calculateConfidence(value, meta, now = new Date()) {
  if (value === null || value === undefined) return 0;

  const countFactor = Math.min((meta.measurement_count || 1) / 5, 1.0);

  let recencyFactor = 1.0;
  if (meta.last_measured) {
    const daysSince = (now - new Date(meta.last_measured)) / (1000 * 60 * 60 * 24);
    recencyFactor = Math.exp(-daysSince / 90);
  }

  return Math.round(countFactor * recencyFactor * 1000) / 1000;
}

/**
 * Detect current step from twin data (indicators.stage.current)
 * @returns {number|null}
 */
export function detectStep(twinData) {
  const stageCode = twinData?.indicators?.stage?.current;
  if (!stageCode) return null;
  return STAGE_CODES[stageCode] ?? null;
}

/**
 * Calculate weighted mean, skipping null/undefined values.
 * @param {{ value: number|null, weight: number }[]} items
 * @returns {number|null} null if no valid values
 */
function weightedMean(items) {
  let sumWV = 0;
  let sumW = 0;
  for (const { value, weight } of items) {
    if (value === null || value === undefined) continue;
    const num = typeof value === "number" ? value : parseFloat(value);
    if (isNaN(num)) continue;
    sumWV += num * weight;
    sumW += weight;
  }
  if (sumW === 0) return null;
  return Math.round((sumWV / sumW) * 1000) / 1000; // 3 decimal places
}

/**
 * Calculate dimension (worldview or mastery) for one area.
 * Returns score, gap, confidence, and source_indicators with per-indicator confidence.
 */
function calculateDimension(twinData, indicators, norm) {
  const sourceIndicators = indicators.map((ind) => {
    const rawValue = getIndicatorValue(twinData, ind.id);
    const value = rawValue !== undefined ? rawValue : null;
    const meta = getIndicatorMeta(twinData, ind.id);
    const confidence = calculateConfidence(value, meta);
    return {
      id: ind.id,
      name: ind.name,
      value,
      weight: ind.weight,
      norm,
      confidence,
      last_measured: meta.last_measured,
    };
  });

  const score = weightedMean(
    sourceIndicators.map((si) => ({ value: si.value, weight: si.weight }))
  );

  const gap = score !== null ? Math.round((norm - score) * 1000) / 1000 : null;

  // Dimension confidence = weighted mean of indicator confidences (only non-null)
  const validConfs = sourceIndicators.filter(si => si.value !== null);
  const dimensionConfidence = validConfs.length > 0
    ? Math.round(validConfs.reduce((sum, si) => sum + si.confidence, 0) / validConfs.length * 1000) / 1000
    : 0;

  return { score, norm, gap, confidence: dimensionConfidence, source_indicators: sourceIndicators };
}

/**
 * Main calculation: twin data → profile by 5 areas.
 *
 * @param {object} twinData - Full twin JSON
 * @param {number} step - Student step (1-5)
 * @param {string} userId - User ID for response
 * @returns {object} Profile response matching SPEC schema
 */
/**
 * Minimum confidence threshold for a GAP to be actionable.
 * Below this → "measure first, don't act on stale data".
 */
const MIN_CONFIDENCE = 0.3;

export function calculateProfile(twinData, step, userId) {
  const leadingKeys = LEADING_AREAS[step] || [];
  const norms = NORMS[step] || { leading: 1.0, supporting: 1.0 };

  // First pass: calculate all areas
  const areas = AREAS.map(({ key, name }) => {
    const role = leadingKeys.includes(key) ? "leading" : "supporting";
    const norm = role === "leading" ? norms.leading : norms.supporting;
    const mapping = AREA_MAPPING[key];

    const worldview = calculateDimension(twinData, mapping.worldview, norm);
    const mastery = calculateDimension(twinData, mapping.mastery, norm);

    return { area: key, area_name: name, role, worldview, mastery, blocked: false, blocked_by: [] };
  });

  // Second pass: prerequisite filter (inner fringe)
  // Area is blocked if any prerequisite area has gap > 0 with sufficient confidence
  const areaMap = Object.fromEntries(areas.map(a => [a.area, a]));
  for (const area of areas) {
    const prereqs = PREREQUISITES[area.area] || [];
    const blockers = [];
    for (const prereqKey of prereqs) {
      const prereqArea = areaMap[prereqKey];
      if (!prereqArea) continue;
      // Check if prerequisite has significant gap (either dimension)
      for (const dim of ["worldview", "mastery"]) {
        const g = prereqArea[dim].gap;
        const c = prereqArea[dim].confidence;
        if (g !== null && g > 0.1 && c >= MIN_CONFIDENCE) {
          blockers.push(`${prereqKey}.${dim}`);
        }
      }
    }
    if (blockers.length > 0) {
      area.blocked = true;
      area.blocked_by = blockers;
    }
  }

  // Find max GAP with priority: non-blocked > blocked, then biggest gap
  // Two passes: first try non-blocked, then all (fallback)
  let maxGap = { area: null, dimension: null, gap: null, blocked: false };

  for (const preferNonBlocked of [true, false]) {
    if (maxGap.area !== null) break;
    let best = { area: null, dimension: null, gap: -Infinity, blocked: false };
    for (const area of areas) {
      if (preferNonBlocked && area.blocked) continue;
      for (const dim of ["worldview", "mastery"]) {
        const g = area[dim].gap;
        if (g !== null && g > 0 && g > best.gap) {
          best = { area: area.area, dimension: dim, gap: g, blocked: area.blocked };
        }
      }
    }
    if (best.area !== null) maxGap = best;
  }

  const nextStep = step < 5 ? step + 1 : null;

  return {
    user_id: userId,
    step,
    step_name: STAGE_NAMES[step] || `Step ${step}`,
    mapping_version: MAPPING_VERSION,
    timestamp: new Date().toISOString(),
    areas,
    max_gap: maxGap,
    transition: nextStep
      ? {
          from: step,
          to: nextStep,
          leading_areas: leadingKeys,
          key_shift: KEY_SHIFTS[step] || "",
        }
      : null,
  };
}

/**
 * Compare profile against baseline for the step.
 * Returns array of anomalies where score is outside expected range.
 * @returns {{ area: string, dimension: string, score: number, expected: [number, number] }[]}
 */
export function detectDrifts(profile) {
  const baseline = BASELINE_PROFILES[profile.step];
  if (!baseline) return [];

  const drifts = [];
  for (const area of profile.areas) {
    for (const dim of ["worldview", "mastery"]) {
      const score = area[dim].score;
      if (score === null) continue;
      const range = baseline[area.area]?.[dim];
      if (!range) continue;
      if (score < range[0] - 0.1 || score > range[1] + 0.1) {
        drifts.push({
          area: area.area,
          dimension: dim,
          score,
          expected: range,
        });
      }
    }
  }
  return drifts;
}

/**
 * Generate human-readable debug report from profile.
 * For наставников and developers — explains WHY this recommendation.
 */
export function generateDebugReport(profile) {
  const lines = [];
  const { step, step_name, areas, max_gap, transition } = profile;

  lines.push(`# Профиль развития (debug)`);
  lines.push(`Ступень: ${step} (${step_name}) | mapping: v${profile.mapping_version}`);
  lines.push("");

  // Visual bars per area
  lines.push("## Области");
  lines.push("");
  lines.push("| Область | Мировоззрение | Мастерство | Роль | Blocked |");
  lines.push("|---------|--------------|------------|------|---------|");

  for (const area of areas) {
    const wvScore = area.worldview.score !== null ? area.worldview.score.toFixed(2) : "n/a";
    const maScore = area.mastery.score !== null ? area.mastery.score.toFixed(2) : "n/a";
    const wvConf = area.worldview.confidence !== undefined ? ` (c:${area.worldview.confidence})` : "";
    const maConf = area.mastery.confidence !== undefined ? ` (c:${area.mastery.confidence})` : "";
    const blocked = area.blocked ? `YES: ${area.blocked_by.join(", ")}` : "—";
    lines.push(`| **${area.area_name}** | ${wvScore}/${area.worldview.norm}${wvConf} | ${maScore}/${area.mastery.norm}${maConf} | ${area.role} | ${blocked} |`);
  }

  // Max GAP reasoning
  lines.push("");
  lines.push("## Рекомендация (max_gap)");
  if (max_gap.area) {
    const areaObj = areas.find(a => a.area === max_gap.area);
    const dim = areaObj[max_gap.dimension];
    lines.push(`**Область:** ${areaObj.area_name} → ${max_gap.dimension}`);
    lines.push(`**GAP:** ${max_gap.gap} (score ${dim.score} / norm ${dim.norm})`);
    lines.push(`**Blocked:** ${max_gap.blocked ? "yes" : "no"}`);
    lines.push("");
    lines.push("**Источники:**");
    for (const si of dim.source_indicators) {
      const val = si.value !== null ? si.value : "NULL";
      const conf = si.confidence !== undefined ? ` conf:${si.confidence}` : "";
      const measured = si.last_measured ? ` (${si.last_measured})` : "";
      lines.push(`- ${si.id} ${si.name}: ${val} × w${si.weight}${conf}${measured}`);
    }
  } else {
    lines.push("Нет данных для рекомендации (все показатели null)");
  }

  // Transition
  if (transition) {
    lines.push("");
    lines.push("## Переход");
    lines.push(`${transition.from} → ${transition.to}: ${transition.key_shift}`);
    lines.push(`Ведущие области: ${transition.leading_areas.join(", ")}`);
  }

  // Null indicators warning
  const nullInds = [];
  for (const area of areas) {
    for (const dim of ["worldview", "mastery"]) {
      for (const si of area[dim].source_indicators) {
        if (si.value === null) nullInds.push(`${si.id} (${si.name})`);
      }
    }
  }
  if (nullInds.length > 0) {
    lines.push("");
    lines.push(`## Отсутствующие данные (${nullInds.length} показателей)`);
    for (const ind of nullInds) {
      lines.push(`- ${ind}`);
    }
  }

  // Drift detection
  const drifts = detectDrifts(profile);
  if (drifts.length > 0) {
    lines.push("");
    lines.push(`## Аномалии (${drifts.length})`);
    for (const d of drifts) {
      lines.push(`- **${d.area}.${d.dimension}**: score ${d.score} вне ожидаемого [${d.expected[0]}, ${d.expected[1]}] для ступени ${step}`);
    }
  }

  return lines.join("\n");
}
