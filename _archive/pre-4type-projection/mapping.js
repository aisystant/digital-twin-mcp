/**
 * Mapping configuration: ЦД indicators (3_*) → 5 development areas
 *
 * Source-of-truth (domain): PD.FORM.080 §9, PD.FORM.081 (Pack)
 * This file: implementation (formulas, weights) — HD #29
 *
 * When Pack changes → update this file → increment MAPPING_VERSION
 */

export const MAPPING_VERSION = "1.1.0";

/**
 * Stage names (Russian) indexed by step number
 */
export const STAGE_NAMES = {
  1: "Случайный",
  2: "Практикующий",
  3: "Систематический",
  4: "Дисциплинированный",
  5: "Проактивный",
};

/**
 * Stage codes used in ЦД (indicators.stage.current)
 */
export const STAGE_CODES = {
  "STG.Student.Random": 1,
  "STG.Student.Practicing": 2,
  "STG.Student.Systematic": 3,
  "STG.Student.Disciplined": 4,
  "STG.Student.Proactive": 5,
};

/**
 * 5 areas with Russian names (FORM.081)
 */
export const AREAS = [
  { key: "knowledge", name: "Знания" },
  { key: "tools", name: "Инструменты" },
  { key: "constraints", name: "Ограничения" },
  { key: "environment", name: "Окружение" },
  { key: "organism", name: "Организм" },
];

/**
 * Mapping: area × dimension → indicator paths in twin data
 *
 * Each entry: { id: IND code (key in indicators.metrics), name: Russian name, weight: number }
 * Aggregation: weighted_mean over all indicators in the group
 *
 * Lookup: twinData.indicators.metrics[id] — id is a flat key with dots (e.g. "IND.3.2.04")
 * Indicators that don't yet exist in twin data will be returned as null.
 */
export const AREA_MAPPING = {
  knowledge: {
    worldview: [
      { id: "IND.3.2.04", name: "Развитие мировоззрения", weight: 1.0 },
      { id: "IND.3.3.04", name: "Текущие мемы", weight: 1.0 },
    ],
    mastery: [
      { id: "IND.3.2.01", name: "Интенсивность практики", weight: 1.0 },
      { id: "IND.3.2.05", name: "Трансформация привычек", weight: 1.0 },
    ],
  },
  tools: {
    worldview: [
      { id: "IND.3.9.1", name: "Качество взаимодействия с ИИ", weight: 1.0 },
    ],
    mastery: [
      { id: "IND.3.2.02", name: "Индекс продуктов", weight: 1.0 },
      { id: "IND.3.2.03", name: "Учтённое время", weight: 1.0 },
      { id: "IND.3.9.2", name: "Применение рекомендаций ИИ", weight: 0.5 },
    ],
  },
  constraints: {
    worldview: [
      { id: "IND.3.3.03", name: "Поведенческие паттерны", weight: 1.0 },
    ],
    mastery: [
      { id: "IND.3.1.04", name: "Частота срывов", weight: 1.0 },
      { id: "IND.3.6.04", name: "Управление состоянием", weight: 1.0 },
    ],
  },
  environment: {
    worldview: [
      { id: "IND.3.3.05", name: "Калибр личности", weight: 1.0 },
      { id: "IND.3.3.02", name: "Контроль среды", weight: 1.0 },
    ],
    mastery: [
      { id: "IND.3.7.1", name: "Помощь сообществу", weight: 1.0 },
      { id: "IND.3.7.2", name: "Публикации и вклад", weight: 1.0 },
    ],
  },
  organism: {
    worldview: [
      { id: "IND.3.6.01", name: "Индекс ресурсности", weight: 1.0 },
    ],
    mastery: [
      { id: "IND.3.6.02", name: "Ритм работа-отдых", weight: 1.0 },
      { id: "IND.3.6.03", name: "Устойчивость", weight: 1.0 },
      { id: "IND.3.6.05", name: "Частота методов восстановления", weight: 0.5 },
    ],
  },
};

/**
 * Prerequisite graph between areas (from FORM.080 §3, cycle B.4).
 * Key: area. Value: areas that must have gap < norm before this area is actionable.
 * Simple 5-node DAG, not a full Knowledge Space.
 */
export const PREREQUISITES = {
  knowledge: ["organism"],
  tools: ["knowledge"],
  constraints: ["knowledge", "organism"],
  environment: ["knowledge", "constraints"],
  organism: [], // foundation, no prerequisites
};

/**
 * Leading areas per transition (from FORM.080 §3)
 * Key: current step. Value: areas that are "leading" for transition to next step.
 */
export const LEADING_AREAS = {
  1: ["knowledge", "organism"],
  2: ["tools", "constraints"],
  3: ["knowledge", "constraints", "environment"],
  4: ["environment", "knowledge"],
  5: [], // target state, no transition
};

/**
 * Norms per transition (from FORM.080)
 * Key: current step. Value: { leading: norm, supporting: norm }
 * Norms are [0, 1] scores that area must reach for transition.
 */
export const NORMS = {
  1: { leading: 0.60, supporting: 0.40 },
  2: { leading: 0.65, supporting: 0.45 },
  3: { leading: 0.70, supporting: 0.50 },
  4: { leading: 0.80, supporting: 0.60 },
  5: { leading: 1.0, supporting: 1.0 }, // no transition
};

/**
 * Baseline profiles: expected score distribution per step (from FORM.080).
 * Used for drift detection: if real distribution deviates significantly → alert.
 * Each area has expected score ranges [min, max] for worldview and mastery.
 */
export const BASELINE_PROFILES = {
  1: { // Случайный: low everywhere, especially knowledge and organism
    knowledge:    { worldview: [0.0, 0.3], mastery: [0.0, 0.2] },
    tools:        { worldview: [0.0, 0.2], mastery: [0.0, 0.2] },
    constraints:  { worldview: [0.0, 0.2], mastery: [0.0, 0.2] },
    environment:  { worldview: [0.0, 0.2], mastery: [0.0, 0.1] },
    organism:     { worldview: [0.1, 0.4], mastery: [0.1, 0.3] },
  },
  2: { // Практикующий: tools and constraints growing
    knowledge:    { worldview: [0.2, 0.5], mastery: [0.2, 0.5] },
    tools:        { worldview: [0.1, 0.4], mastery: [0.2, 0.5] },
    constraints:  { worldview: [0.1, 0.4], mastery: [0.2, 0.5] },
    environment:  { worldview: [0.1, 0.3], mastery: [0.0, 0.2] },
    organism:     { worldview: [0.3, 0.6], mastery: [0.3, 0.5] },
  },
  3: { // Систематический: knowledge, constraints, environment growing
    knowledge:    { worldview: [0.4, 0.7], mastery: [0.4, 0.6] },
    tools:        { worldview: [0.4, 0.6], mastery: [0.5, 0.7] },
    constraints:  { worldview: [0.3, 0.6], mastery: [0.4, 0.6] },
    environment:  { worldview: [0.2, 0.5], mastery: [0.1, 0.4] },
    organism:     { worldview: [0.5, 0.7], mastery: [0.4, 0.6] },
  },
  4: { // Дисциплинированный: environment and knowledge leading
    knowledge:    { worldview: [0.6, 0.8], mastery: [0.5, 0.7] },
    tools:        { worldview: [0.5, 0.7], mastery: [0.6, 0.8] },
    constraints:  { worldview: [0.5, 0.7], mastery: [0.5, 0.7] },
    environment:  { worldview: [0.4, 0.7], mastery: [0.3, 0.6] },
    organism:     { worldview: [0.6, 0.8], mastery: [0.5, 0.7] },
  },
  5: { // Проактивный: all high
    knowledge:    { worldview: [0.7, 1.0], mastery: [0.7, 1.0] },
    tools:        { worldview: [0.7, 1.0], mastery: [0.7, 1.0] },
    constraints:  { worldview: [0.7, 1.0], mastery: [0.7, 1.0] },
    environment:  { worldview: [0.6, 1.0], mastery: [0.6, 1.0] },
    organism:     { worldview: [0.7, 1.0], mastery: [0.7, 1.0] },
  },
};

/**
 * Key shift descriptions per transition (from FORM.080 §3)
 */
export const KEY_SHIFTS = {
  1: "«Не вижу смысла» → «Интересно...» + ресурсная база",
  2: "«Пробую» → «Делаю каждый день» + конвейер",
  3: "«По процессу» → «Строю путь» + калибр «команда»",
  4: "«Строю путь» → «Мы меняем мир» + передача культуры",
  5: "Целевое состояние (выход в Работник)",
};
