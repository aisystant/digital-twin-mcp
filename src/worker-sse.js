/**
 * Digital Twin MCP Server - Cloudflare Workers (HTTP Transport)
 *
 * Tools:
 * - Metamodel: get_degrees, get_stages, get_indicator_groups, get_indicators, get_indicator, get_stage_thresholds, validate_value
 * - Data: read_digital_twin, write_digital_twin
 */

// Import metamodel JSON files (bundled at build time)
import stages from "./stages.json";
import groups from "./groups.json";
import indicators from "./indicators.json";
import degrees from "./degrees.json";

// Default twin data (used when KV is empty)
const DEFAULT_TWIN_DATA = {
  degree: "DEG.Student",
  stage: "STG.Student.Practicing",
  indicators: {
    "IND.1.PREF.objective": "Освоить системное мышление",
    "IND.1.PREF.role_set": ["developer", "learner"],
    "IND.1.PREF.weekly_time_budget": 10,
    "IND.2.1.1": 8.5,
    "IND.2.1.2": 0.85,
  },
};

// KV key for twin data
const TWIN_KEY = "twin:default";

// Get twin data from KV (or default if not exists)
async function getTwinData(env) {
  if (!env?.DIGITAL_TWIN_DATA) {
    return { ...DEFAULT_TWIN_DATA };
  }
  const data = await env.DIGITAL_TWIN_DATA.get(TWIN_KEY, "json");
  return data || { ...DEFAULT_TWIN_DATA };
}

// Save twin data to KV
async function saveTwinData(env, data) {
  if (!env?.DIGITAL_TWIN_DATA) {
    return false;
  }
  await env.DIGITAL_TWIN_DATA.put(TWIN_KEY, JSON.stringify(data));
  return true;
}

// Normalize path: both dots and slashes work
function normalizePath(p) {
  return p.replace(/\//g, ".").replace(/^\.+|\.+$/g, "");
}

// Get value by path
function getByPath(obj, pathStr) {
  const parts = normalizePath(pathStr).split(".");
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

// Set value by path
function setByPath(obj, pathStr, value) {
  const parts = normalizePath(pathStr).split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// ============ Metamodel Tools ============

// Tool: get_degrees
function getDegrees() {
  return degrees;
}

// Tool: get_stages
function getStages() {
  return stages;
}

// Tool: get_indicator_groups
function getIndicatorGroups() {
  return groups;
}

// Tool: get_indicators
function getIndicators(groupCode, forPrompts, forQualification) {
  let filtered = indicators.indicators;

  if (groupCode) {
    filtered = filtered.filter(ind => ind.group === groupCode);
  }
  if (forPrompts !== undefined) {
    filtered = filtered.filter(ind => ind.for_prompts === forPrompts);
  }
  if (forQualification !== undefined) {
    filtered = filtered.filter(ind => ind.for_qualification === forQualification);
  }

  return {
    ...indicators,
    indicators: filtered,
    count: filtered.length
  };
}

// Tool: get_indicator
function getIndicator(code) {
  const indicator = indicators.indicators.find(ind => ind.code === code);
  if (!indicator) {
    return { error: `Indicator not found: ${code}` };
  }
  return indicator;
}

// Tool: get_stage_thresholds
function getStageThresholds(indicatorCode) {
  const indicator = indicators.indicators.find(ind => ind.code === indicatorCode);

  if (!indicator) {
    return { error: `Indicator not found: ${indicatorCode}` };
  }

  if (!indicator.thresholds) {
    return {
      indicator: indicatorCode,
      message: "This indicator does not have stage thresholds",
      for_qualification: indicator.for_qualification || false
    };
  }

  // Enrich thresholds with stage names
  const enrichedThresholds = {};
  for (const [stageCode, threshold] of Object.entries(indicator.thresholds)) {
    const stage = stages.stages.find(s => s.code === stageCode);
    enrichedThresholds[stageCode] = {
      ...threshold,
      stage_name: stage?.name || stageCode,
      stage_order: stage?.order
    };
  }

  return {
    indicator: indicatorCode,
    indicator_name: indicator.name,
    unit: indicator.unit,
    thresholds: enrichedThresholds
  };
}

// Tool: validate_value
function validateValue(indicatorCode, value) {
  const indicator = indicators.indicators.find(ind => ind.code === indicatorCode);

  if (!indicator) {
    return { valid: false, error: `Indicator not found: ${indicatorCode}` };
  }

  const errors = [];

  // Check format/type
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
    case "date":
      if (typeof value !== "string" || isNaN(Date.parse(value))) {
        errors.push(`Expected valid date string`);
      }
      break;
    case "json":
    case "array":
      if (typeof value !== "object") {
        errors.push(`Expected object or array, got ${typeof value}`);
      }
      break;
  }

  // Check range constraints
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
    errors: errors.length > 0 ? errors : undefined
  };
}

// ============ Data Tools ============

// Tool: read_digital_twin
async function readDigitalTwin(env, pathArg) {
  const twinData = await getTwinData(env);
  const value = getByPath(twinData, pathArg);
  if (value === undefined) return { error: `Path not found: ${pathArg}` };
  return value;
}

// Tool: write_digital_twin
async function writeDigitalTwin(env, pathArg, value) {
  const twinData = await getTwinData(env);
  setByPath(twinData, pathArg, value);
  const saved = await saveTwinData(env, twinData);
  return {
    success: true,
    path: pathArg,
    value,
    persisted: saved
  };
}

// ============ MCP Protocol ============

// Tools schema
const tools = [
  // Metamodel tools
  {
    name: "get_degrees",
    description: "Get all qualification degrees (DEG.*) from Freshman to Public Figure with descriptions.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_stages",
    description: "Get all student stages (STG.Student.*) within the Student degree, with period weeks.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_indicator_groups",
    description: "Get all indicator groups (1.PREF, 2.1-2.10) with their names and categories.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_indicators",
    description: "Get indicators from the metamodel. Optionally filter by group code or for_prompts/for_qualification flags.",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string", description: "Filter by group code (e.g., '1.PREF', '2.1', '2.4')" },
        for_prompts: { type: "boolean", description: "Filter indicators used in prompts" },
        for_qualification: { type: "boolean", description: "Filter indicators used for qualification assessment" },
      },
    },
  },
  {
    name: "get_indicator",
    description: "Get a single indicator by its code with full details including thresholds.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Indicator code (e.g., 'IND.1.PREF.objective', 'IND.2.1.1')" },
      },
      required: ["code"],
    },
  },
  {
    name: "get_stage_thresholds",
    description: "Get threshold values for an indicator across all stages. Useful for understanding qualification criteria.",
    inputSchema: {
      type: "object",
      properties: {
        indicator: { type: "string", description: "Indicator code (e.g., 'IND.2.1.1' for weekly hours)" },
      },
      required: ["indicator"],
    },
  },
  {
    name: "validate_value",
    description: "Validate a value against indicator schema (type, format, enum values, min/max).",
    inputSchema: {
      type: "object",
      properties: {
        indicator: { type: "string", description: "Indicator code to validate against" },
        value: { description: "Value to validate (any JSON type)" },
      },
      required: ["indicator", "value"],
    },
  },
  // Data tools
  {
    name: "read_digital_twin",
    description: "Read data from the digital twin by path. Use dot notation for nested paths.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path (e.g., 'degree', 'stage', 'indicators.IND.1.PREF.objective')" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_digital_twin",
    description: "Write data to the digital twin by path.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path (e.g., 'indicators.IND.1.PREF.role_set')" },
        data: { description: "Data to write (any JSON value)" },
      },
      required: ["path", "data"],
    },
  },
];

// Handle tool calls
async function callTool(env, name, args) {
  switch (name) {
    case "get_degrees":
      return getDegrees();
    case "get_stages":
      return getStages();
    case "get_indicator_groups":
      return getIndicatorGroups();
    case "get_indicators":
      return getIndicators(args.group, args.for_prompts, args.for_qualification);
    case "get_indicator":
      return getIndicator(args.code);
    case "get_stage_thresholds":
      return getStageThresholds(args.indicator);
    case "validate_value":
      return validateValue(args.indicator, args.value);
    case "read_digital_twin":
      return await readDigitalTwin(env, args.path);
    case "write_digital_twin":
      return await writeDigitalTwin(env, args.path, args.data);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// Handle MCP JSON-RPC
async function handleMCP(env, message) {
  const { jsonrpc, id, method, params } = message;

  if (jsonrpc !== "2.0") {
    return { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid Request" } };
  }

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "digital-twin-mcp", version: "2.1.0" },
        },
      };

    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools } };

    case "tools/call": {
      const { name, arguments: args } = params;
      const result = await callTool(env, name, args || {});

      if (result?.error && typeof result.error === "string") {
        return { jsonrpc: "2.0", id, error: { code: -32000, message: result.error } };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        },
      };
    }

    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

// ============ HTTP Handler ============

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // MCP endpoint
    if (url.pathname === "/mcp" || url.pathname === "/") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({
          info: "Digital Twin MCP Server v2.1",
          usage: "POST JSON-RPC to this endpoint",
          storage: env?.DIGITAL_TWIN_DATA ? "KV (persistent)" : "in-memory (non-persistent)",
          tools: tools.map(t => ({ name: t.name, description: t.description })),
          metamodel: {
            indicators: indicators.indicators.length,
            groups: groups.groups.length,
            degrees: degrees.degrees.length,
            stages: stages.stages.length,
          }
        }, null, 2), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const message = await request.json();
      const response = await handleMCP(env, message);
      return new Response(JSON.stringify(response, null, 2), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found", endpoints: ["/mcp"] }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
