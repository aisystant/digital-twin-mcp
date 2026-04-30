/**
 * Database schema parameterization utility for Digital Twin MCP
 *
 * Replaces hardcoded schema.table references with environment-based qualifiers.
 * Schema defaults to "indicators" unless overridden via INDICATORS_DB_SCHEMA env var.
 */

export function getIndicatorsSchema(env) {
  return (env?.INDICATORS_DB_SCHEMA || process.env.INDICATORS_DB_SCHEMA) || "indicators";
}

/**
 * Qualify table name with schema prefix.
 * Returns unescaped string — let neon/sql handle escaping via template literals.
 *
 * @param table Table name (e.g., "digital_twins")
 * @param schema Schema name (default: "indicators")
 * @returns Qualified name (e.g., "indicators.digital_twins")
 */
function qualifyTable(table, schema) {
  return `${schema}.${table}`;
}

export const INDICATORS_TABLES = {
  digital_twins: (schema) => qualifyTable("digital_twins", schema || getIndicatorsSchema()),
};
