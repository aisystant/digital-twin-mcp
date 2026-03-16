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

// ============================================
// Storage backend: Neon (if DATABASE_URL set) or file (twin.json)
// ============================================

const DATABASE_URL = process.env.DATABASE_URL;
const DT_USER_ID = process.env.DT_USER_ID;
const useNeon = !!(DATABASE_URL && DT_USER_ID);

let neonSql = null;
let _neonMigrated = false;

async function getNeonSql() {
  if (neonSql) return neonSql;
  const { neon } = await import("@neondatabase/serverless");
  neonSql = neon(DATABASE_URL);
  return neonSql;
}

async function ensureNeonTable(sql) {
  if (_neonMigrated) return;
  await sql`
    CREATE TABLE IF NOT EXISTS digital_twins (
      user_id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  _neonMigrated = true;
}

// Unified read
async function readTwinData() {
  if (useNeon) {
    const sql = await getNeonSql();
    await ensureNeonTable(sql);
    const rows = await sql`SELECT data FROM digital_twins WHERE user_id = ${DT_USER_ID}`;
    return rows.length ? deepParseJSONStrings(rows[0].data) : {};
  }
  const content = await fs.readFile(DATA_PATH, "utf-8");
  return JSON.parse(content);
}

// Unified write
async function writeTwinData(data) {
  if (useNeon) {
    const sql = await getNeonSql();
    await ensureNeonTable(sql);
    await sql`
      INSERT INTO digital_twins (user_id, data, updated_at)
      VALUES (${DT_USER_ID}, ${JSON.stringify(data)}, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return;
  }
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2));
}

// ============================================
// Path helpers
// ============================================

function normalizePath(pathStr) {
  return pathStr.replace(/\//g, ".").replace(/^\.+|\.+$/g, "");
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
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Recursively parse string values that contain JSON objects/arrays.
 * Aligns with worker-sse.js behavior for Neon JSONB data.
 */
function deepParseJSONStrings(obj) {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(deepParseJSONStrings);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
      try {
        result[key] = deepParseJSONStrings(JSON.parse(value));
      } catch {
        result[key] = value;
      }
    } else if (typeof value === "object" && value !== null) {
      result[key] = deepParseJSONStrings(value);
    } else {
      result[key] = value;
    }
  }
  return result;
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

// Access control matrix for 4-type classification
const ACCESS_CONTROL = {
  "1_declarative": { user: "rw", guide: "r", system: "rw" },
  "2_collected": { user: "r", guide: "r", system: "w" },
  "3_derived": { user: "r", guide: "r", system: "w" },
  "4_generated": { user: "r", guide: "rg", system: "g" },
};

// Helper: check if user can write to path
function canUserWrite(pathStr) {
  const category = pathStr.split("/")[0].split(".")[0];
  const access = ACCESS_CONTROL[category];
  if (!access) return true; // Allow writes to unknown paths (backward compat)
  return access.user.includes("w");
}

// Tool: describe_by_path - reads metamodel MD files (supports nested 4-type structure)
async function describeByPath(pathArg) {
  // Handle empty or root path - list categories
  if (!pathArg || pathArg === "/" || pathArg === ".") {
    const entries = await fs.readdir(METAMODEL_PATH, { withFileTypes: true });
    const results = [];

    // List _shared files first
    const sharedPath = path.join(METAMODEL_PATH, "_shared");
    try {
      const sharedEntries = await fs.readdir(sharedPath, { withFileTypes: true });
      for (const entry of sharedEntries) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          results.push(`${entry.name.replace(".md", "")}:document:Shared metamodel document`);
        }
      }
    } catch {
      // _shared may not exist
    }

    // List category folders (1_declarative, 2_collected, etc.)
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith("_")) {
        const groupMdPath = path.join(METAMODEL_PATH, entry.name, "_group.md");
        try {
          const content = await fs.readFile(groupMdPath, "utf-8");
          const firstLine = content.split("\n").find(l => l.startsWith("# "));
          const desc = firstLine ? firstLine.replace("# ", "").trim() : entry.name;
          results.push(`${entry.name}:category:${desc}`);
        } catch {
          results.push(`${entry.name}:category:`);
        }
      }
    }

    return results.join("\n");
  }

  // For metamodel paths, use slash as separator
  const targetPath = path.join(METAMODEL_PATH, pathArg.replace(/\//g, path.sep));

  try {
    const stat = await fs.stat(targetPath);

    if (stat.isDirectory()) {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const results = [];

      // List subdirectories (subgroups)
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subgroupMdPath = path.join(targetPath, entry.name, "_group.md");
          let desc = entry.name;
          try {
            const content = await fs.readFile(subgroupMdPath, "utf-8");
            const firstLine = content.split("\n").find(l => l.startsWith("# "));
            if (firstLine) desc = firstLine.replace("# ", "").trim();
          } catch {}
          results.push(`${entry.name}:group:${desc}`);
        }
      }

      // List MD files (indicators)
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

  // Parse string values that are actually JSON objects/arrays
  if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
    try { return JSON.parse(value); } catch {}
  }
  if (typeof value === "object" && value !== null) {
    return deepParseJSONStrings(value);
  }
  return value;
}

// Tool: write_digital_twin - writes twin data by path (with access control)
async function writeDigitalTwin(pathArg, value, role = "user") {
  // Check access control for metamodel paths
  if (!canUserWrite(pathArg) && role === "user") {
    return {
      error: `Access denied: users cannot write to ${pathArg.split("/")[0]}`,
      hint: "Only IND.1.* (1_declarative) paths are writable by users"
    };
  }

  const data = await readTwinData();
  setByPath(data, pathArg, value);
  await writeTwinData(data);
  return { success: true, path: pathArg, value };
}

// Create MCP server
const server = new Server(
  {
    name: "digital-twin-mcp-server",
    version: "2.1.0",
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
          "Describe the digital twin metamodel structure (4-type classification: IND.1-4). Returns categories, groups, and indicators.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path in metamodel. Examples: '/' (list categories), '1_declarative' (list subgroups), '1_declarative/1_2_goals' (list indicators)",
            },
          },
        },
      },
      {
        name: "read_digital_twin",
        description:
          "Read data from the digital twin by path. All indicator types (IND.1-4) are readable. Includes engagement metrics (2_collected) synced from the learning bot.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Path to data. Examples: '2_collected' (all engagement), '2_collected/2_1_account' (sessions), '2_collected/2_4_time' (activity rhythm), '1_declarative/1_2_goals' (declared goals)",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "write_digital_twin",
        description:
          "Write data to the digital twin. Only IND.1.* (1_declarative) paths are writable by users. IND.2-4 are system-only.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Path to data. User can write to 1_declarative/* only",
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
  const backend = useNeon ? `Neon (user: ${DT_USER_ID.substring(0, 8)}...)` : `file (${DATA_PATH})`;
  console.error(`Digital Twin MCP Server v2.1.0 running on stdio [${backend}]`);
  console.error("Tools: describe_by_path, read_digital_twin, write_digital_twin");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
