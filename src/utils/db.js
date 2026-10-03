/**
 * Database schema parameterization utility for Digital Twin MCP
 *
 * Resolves the local Neon schema; identifier validation is performed by the storage adapter.
 * Schema defaults to "indicators" unless overridden via INDICATORS_DB_SCHEMA env var.
 */

export function getIndicatorsSchema(env) {
  return env?.INDICATORS_DB_SCHEMA ?? "indicators";
}
