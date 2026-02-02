import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const METAMODEL_PATH = path.join(__dirname, "..", "metamodel");
const DATA_PATH = path.join(__dirname, "..", "data", "twin.json");

// Load metamodel JSON files
async function loadMetamodel() {
  const [stagesData, groupsData, indicatorsData, degreesData] = await Promise.all([
    fs.readFile(path.join(METAMODEL_PATH, "stages.json"), "utf-8"),
    fs.readFile(path.join(METAMODEL_PATH, "groups.json"), "utf-8"),
    fs.readFile(path.join(METAMODEL_PATH, "indicators.json"), "utf-8"),
    fs.readFile(path.join(METAMODEL_PATH, "degrees.json"), "utf-8"),
  ]);
  return {
    stages: JSON.parse(stagesData),
    groups: JSON.parse(groupsData),
    indicators: JSON.parse(indicatorsData),
    degrees: JSON.parse(degreesData),
  };
}

// Helper: read and parse twin data
async function readTwinData() {
  const content = await fs.readFile(DATA_PATH, "utf-8");
  return JSON.parse(content);
}

// Helper: write twin data
async function writeTwinData(data) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2));
}

// Helper: normalize path - accept both dots and slashes
function normalizePath(pathStr) {
  return pathStr.replace(/\//g, ".").replace(/^\.+|\.+$/g, "");
}

// Helper: get value by path (accepts both "indicators.agency.role_set" and "indicators/agency/role_set")
function getByPath(obj, pathStr) {
  const parts = normalizePath(pathStr).split(".");
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

// Helper: set value by path (accepts both dots and slashes)
function setByPath(obj, pathStr, value) {
  const parts = normalizePath(pathStr).split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

// Tool: get_stages - returns all student stages
async function getStages() {
  const metamodel = await loadMetamodel();
  return metamodel.stages;
}

// Tool: get_indicator_groups - returns all indicator groups
async function getIndicatorGroups() {
  const metamodel = await loadMetamodel();
  return metamodel.groups;
}

// Tool: get_indicators - returns indicators with optional filters
async function getIndicators(groupCode, forPrompts, forQualification) {
  const metamodel = await loadMetamodel();
  let filtered = metamodel.indicators.indicators;

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
    ...metamodel.indicators,
    indicators: filtered,
    count: filtered.length
  };
}

// Tool: get_indicator - returns a single indicator by code
async function getIndicator(code) {
  const metamodel = await loadMetamodel();
  const indicator = metamodel.indicators.indicators.find(ind => ind.code === code);
  if (!indicator) {
    return { error: `Indicator not found: ${code}` };
  }
  return indicator;
}

// Tool: get_degrees - returns all qualification degrees
async function getDegrees() {
  const metamodel = await loadMetamodel();
  return metamodel.degrees;
}

// Tool: get_stage_thresholds - returns thresholds for an indicator across stages
async function getStageThresholds(indicatorCode) {
  const metamodel = await loadMetamodel();
  const indicator = metamodel.indicators.indicators.find(ind => ind.code === indicatorCode);

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

  // Enrich thresholds with stage names from stages.json
  const enrichedThresholds = {};
  for (const [stageCode, threshold] of Object.entries(indicator.thresholds)) {
    const stage = metamodel.stages.stages.find(s => s.code === stageCode);
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

// Tool: validate_value - validates a value against indicator schema
async function validateValue(indicatorCode, value) {
  const metamodel = await loadMetamodel();
  const indicator = metamodel.indicators.indicators.find(ind => ind.code === indicatorCode);

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

  // Check range constraints if present
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

// Tool: read_digital_twin - reads twin data by path
async function readDigitalTwin(pathArg) {
  const data = await readTwinData();
  const value = getByPath(data, pathArg);

  if (value === undefined) {
    return { error: `Path not found: ${pathArg}` };
  }

  return value;
}

// Tool: write_digital_twin - writes twin data by path
async function writeDigitalTwin(pathArg, value) {
  const data = await readTwinData();
  setByPath(data, pathArg, value);
  await writeTwinData(data);
  return { success: true, path: pathArg, value };
}

// Create MCP server
const server = new Server(
  {
    name: "digital-twin-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Metamodel tools
      {
        name: "get_degrees",
        description:
          "Get all qualification degrees (DEG.*) from Freshman to Public Figure with descriptions.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_stages",
        description:
          "Get all student stages (STG.Student.*) within the Student degree, with period weeks.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_indicator_groups",
        description:
          "Get all indicator groups (1.PREF, 2.1-2.10) with their names and categories.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_indicators",
        description:
          "Get indicators from the metamodel. Optionally filter by group code or for_prompts/for_qualification flags.",
        inputSchema: {
          type: "object",
          properties: {
            group: {
              type: "string",
              description: "Filter by group code (e.g., '1.PREF', '2.1', '2.4')",
            },
            for_prompts: {
              type: "boolean",
              description: "Filter indicators used in prompts",
            },
            for_qualification: {
              type: "boolean",
              description: "Filter indicators used for qualification assessment",
            },
          },
        },
      },
      {
        name: "get_indicator",
        description:
          "Get a single indicator by its code with full details including thresholds.",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "Indicator code (e.g., 'IND.1.PREF.objective', 'IND.2.1.1', 'IND.2.4.2')",
            },
          },
          required: ["code"],
        },
      },
      {
        name: "get_stage_thresholds",
        description:
          "Get threshold values for an indicator across all stages. Useful for understanding qualification criteria.",
        inputSchema: {
          type: "object",
          properties: {
            indicator: {
              type: "string",
              description: "Indicator code (e.g., 'IND.2.1.1' for weekly self-development hours)",
            },
          },
          required: ["indicator"],
        },
      },
      {
        name: "validate_value",
        description:
          "Validate a value against indicator schema (type, format, enum values, min/max).",
        inputSchema: {
          type: "object",
          properties: {
            indicator: {
              type: "string",
              description: "Indicator code to validate against",
            },
            value: {
              description: "Value to validate (any JSON type)",
            },
          },
          required: ["indicator", "value"],
        },
      },
      // Data tools
      {
        name: "read_digital_twin",
        description:
          "Read data from the digital twin by path. Use dot notation for nested paths.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Path to data (e.g., 'indicators.IND.1.PREF.objective', 'stage', 'degree')",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "write_digital_twin",
        description:
          "Write data to the digital twin by path. Value is validated against indicator schema if path matches an indicator.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Path to data (e.g., 'indicators.IND.1.PREF.role_set', 'stage')",
            },
            data: {
              description: "Data to write (any JSON value)",
            },
          },
          required: ["path", "data"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_degrees") {
      const result = await getDegrees();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "get_stages") {
      const result = await getStages();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "get_indicator_groups") {
      const result = await getIndicatorGroups();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "get_indicators") {
      const result = await getIndicators(args.group, args.for_prompts, args.for_qualification);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "get_indicator") {
      const result = await getIndicator(args.code);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "get_stage_thresholds") {
      const result = await getStageThresholds(args.indicator);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "validate_value") {
      const result = await validateValue(args.indicator, args.value);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "read_digital_twin") {
      const result = await readDigitalTwin(args.path);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "write_digital_twin") {
      const result = await writeDigitalTwin(args.path, args.data);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    return {
      content: [{ type: "text", text: `Error: Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Digital Twin MCP Server running on stdio");
  console.error("Metamodel tools: get_degrees, get_stages, get_indicator_groups, get_indicators, get_indicator, get_stage_thresholds, validate_value");
  console.error("Data tools: read_digital_twin, write_digital_twin");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
