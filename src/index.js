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
  const [stagesData, groupsData, indicatorsData] = await Promise.all([
    fs.readFile(path.join(METAMODEL_PATH, "stages.json"), "utf-8"),
    fs.readFile(path.join(METAMODEL_PATH, "groups.json"), "utf-8"),
    fs.readFile(path.join(METAMODEL_PATH, "indicators.json"), "utf-8"),
  ]);
  return {
    stages: JSON.parse(stagesData),
    groups: JSON.parse(groupsData),
    indicators: JSON.parse(indicatorsData),
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

// Helper: parse MD file to extract type and description
function parseMdFile(content, filename) {
  const lines = content.split("\n");
  let type = "unknown";
  let description = "";

  for (const line of lines) {
    if (line.startsWith("**Type:**")) {
      type = line.replace("**Type:**", "").trim();
    }
    if (line.startsWith("**Description:**")) {
      description = line.replace("**Description:**", "").trim();
    }
  }

  // If no explicit description, use first non-header non-empty line
  if (!description) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("**")) {
        description = trimmed;
        break;
      }
    }
  }

  return { type, description };
}

// Tool: describe_by_path - reads metamodel MD files
async function describeByPath(pathArg) {
  const normalized = normalizePath(pathArg);
  const targetPath = path.join(METAMODEL_PATH, normalized.replace(/\./g, "/"));

  try {
    const stat = await fs.stat(targetPath);

    if (stat.isDirectory()) {
      // Read directory - look for .md files and subdirs
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const results = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Check for section .md file
          const sectionMdPath = path.join(METAMODEL_PATH, normalized.replace(/\./g, "/"), `${entry.name}.md`);
          try {
            const content = await fs.readFile(sectionMdPath, "utf-8");
            const { type, description } = parseMdFile(content, entry.name);
            results.push(`${entry.name}:section:${description}`);
          } catch {
            results.push(`${entry.name}:section:`);
          }
        } else if (entry.name.endsWith(".md") && entry.name !== path.basename(targetPath) + ".md") {
          const name = entry.name.replace(".md", "");
          const content = await fs.readFile(path.join(targetPath, entry.name), "utf-8");
          const { type, description } = parseMdFile(content, name);
          results.push(`${name}:${type}:${description}`);
        }
      }

      // Also check for nested folder's md files
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const nestedPath = path.join(targetPath, entry.name);
          const nestedEntries = await fs.readdir(nestedPath, { withFileTypes: true });
          for (const nested of nestedEntries) {
            if (nested.name.endsWith(".md")) {
              const name = nested.name.replace(".md", "");
              const content = await fs.readFile(path.join(nestedPath, nested.name), "utf-8");
              const { type, description } = parseMdFile(content, name);
              results.push(`${entry.name}.${name}:${type}:${description}`);
            }
          }
        }
      }

      return results.join("\n");
    } else {
      // Single file - shouldn't happen with proper paths, but handle it
      const content = await fs.readFile(targetPath, "utf-8");
      return content;
    }
  } catch (error) {
    // Try with .md extension
    try {
      const mdPath = targetPath + ".md";
      const content = await fs.readFile(mdPath, "utf-8");
      return content;
    } catch {
      return `Error: Path not found: ${pathArg}`;
    }
  }
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

// Tool: get_indicators - returns indicators, optionally filtered by group
async function getIndicators(groupCode) {
  const metamodel = await loadMetamodel();
  if (groupCode) {
    return {
      ...metamodel.indicators,
      indicators: metamodel.indicators.indicators.filter(ind => ind.group === groupCode)
    };
  }
  return metamodel.indicators;
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
      {
        name: "describe_by_path",
        description:
          "Describe the digital twin metamodel structure. Returns field names, types, and descriptions for a given path.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path in metamodel. Both dots and slashes work (e.g., 'indicators', 'indicators/agency', 'indicators.agency')",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "get_stages",
        description:
          "Get all student stages (STG.Student.*) with their properties and thresholds periods.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_indicator_groups",
        description:
          "Get all indicator groups (2.1, 2.2, ... 2.10) with their names and descriptions.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_indicators",
        description:
          "Get indicators from the metamodel. Optionally filter by group code.",
        inputSchema: {
          type: "object",
          properties: {
            group: {
              type: "string",
              description: "Optional group code to filter indicators (e.g., '2.1', '2.2')",
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
              description: "Indicator code (e.g., 'IND.2.1.1', 'IND.2.4.2')",
            },
          },
          required: ["code"],
        },
      },
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
                "Path to data. Both dots and slashes work (e.g., 'indicators.agency.role_set', 'indicators/agency/role_set')",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "write_digital_twin",
        description:
          "Write data to the digital twin by path. Use dot notation for nested paths.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Path to data. Both dots and slashes work (e.g., 'indicators.agency.role_set', 'indicators/agency/goals')",
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
    if (name === "describe_by_path") {
      const result = await describeByPath(args.path);
      return {
        content: [{ type: "text", text: result }],
      };
    }

    if (name === "get_stages") {
      const result = await getStages();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === "get_indicator_groups") {
      const result = await getIndicatorGroups();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === "get_indicators") {
      const result = await getIndicators(args.group);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === "get_indicator") {
      const result = await getIndicator(args.code);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === "read_digital_twin") {
      const result = await readDigitalTwin(args.path);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === "write_digital_twin") {
      const result = await writeDigitalTwin(args.path, args.data);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
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
  console.error("Tools: describe_by_path, get_stages, get_indicator_groups, get_indicators, get_indicator, read_digital_twin, write_digital_twin");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
