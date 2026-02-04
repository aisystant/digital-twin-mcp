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

// Helper: get value by path (accepts both dots and slashes)
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

// Helper: parse MD file to extract metadata
function parseMdFile(content, filename) {
  const lines = content.split("\n");
  const result = {
    name: filename,
    type: "unknown",
    format: "unknown",
    description: ""
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

  // If no explicit description, use first non-header non-meta line
  if (!result.description) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("**") && !trimmed.startsWith("-")) {
        result.description = trimmed;
        break;
      }
    }
  }

  return result;
}

// Tool: describe_by_path - reads metamodel MD files
async function describeByPath(pathArg) {
  // Handle empty or root path - list all groups
  if (!pathArg || pathArg === "/" || pathArg === ".") {
    const entries = await fs.readdir(METAMODEL_PATH, { withFileTypes: true });
    const results = [];

    // List root MD files (stages.md, degrees.md)
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(`${entry.name.replace(".md", "")}:document:Root metamodel document`);
      }
    }

    // List group folders
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Try to read _group.md for description
        const groupMdPath = path.join(METAMODEL_PATH, entry.name, "_group.md");
        try {
          const content = await fs.readFile(groupMdPath, "utf-8");
          const firstLine = content.split("\n").find(l => l.startsWith("# "));
          const desc = firstLine ? firstLine.replace("# ", "").trim() : entry.name;
          results.push(`${entry.name}:group:${desc}`);
        } catch {
          results.push(`${entry.name}:group:`);
        }
      }
    }

    return results.join("\n");
  }

  // For metamodel paths, use slash as separator (folder names can contain dots)
  const targetPath = path.join(METAMODEL_PATH, pathArg.replace(/\//g, path.sep));

  try {
    const stat = await fs.stat(targetPath);

    if (stat.isDirectory()) {
      // Read directory - list indicators in this group
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const results = [];

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
      // Single file - return full content
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

// Tool: read_digital_twin - reads twin data by path
async function readDigitalTwin(pathArg) {
  const data = await readTwinData();

  // If no path, return all data
  if (!pathArg || pathArg === "/" || pathArg === ".") {
    return data;
  }

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
    version: "2.0.0",
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
          "Describe the digital twin metamodel structure. Returns field names, types, and descriptions for a given path. Use empty path or '/' to list all groups.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path in metamodel. Examples: '/' (root), '01_preferences', '02_agency', '01_preferences/09_Цели обучения'",
            },
          },
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
                "Path to data. Both dots and slashes work (e.g., 'indicators.agency.role_set', 'stage')",
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
                "Path to data. Both dots and slashes work (e.g., 'indicators.agency.role_set', 'indicators.agency.goals')",
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
  console.error("Tools: describe_by_path, read_digital_twin, write_digital_twin");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
