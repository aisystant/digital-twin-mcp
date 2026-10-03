import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { ProfileCache } from "./cache.js";
import { normalizePath, setByPath, writeUserTwin } from "./twin-path.js";
import { getIndicatorsSchema } from "./utils/db.js";
import { createPostgresStore, TwinStoreError, storeErrorResult } from "./twin-store.js";
import { createFileStore } from "./file-twin-store.js";
import { SERVER_VERSION, STDIO_TOOLS } from "./tool-catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const METAMODEL_PATH = path.join(__dirname, "..", "metamodel");
const DATA_PATH = path.join(__dirname, "..", "data", "twin.json");

// ============================================
// Storage backend: Neon (if DATABASE_URL set) or file (twin.json)
// ============================================

const DATABASE_URL = process.env.DATABASE_URL;
const DT_USER_ID = process.env.DT_USER_ID;
const LEARNING_URL = process.env.LEARNING_URL;  // Neon learning DB (cp_assessments)
const useNeon = !!(DATABASE_URL && DT_USER_ID);

// Profile projection cache (TTL 5 min, invalidated on write)
const profileCache = new ProfileCache();

let twinStore;
let learningSql;

async function getTwinStore() {
  if (twinStore) return twinStore;
  if (useNeon) {
    const { neon } = await import("@neondatabase/serverless");
    twinStore = createPostgresStore(neon(DATABASE_URL), DT_USER_ID, {
      schema: getIndicatorsSchema(process.env), ensureTable: true,
    });
  } else {
    twinStore = createFileStore(DATA_PATH);
  }
  return twinStore;
}

async function getLearningSql() {
  if (learningSql) return learningSql;
  const { neon } = await import("@neondatabase/serverless");
  learningSql = neon(LEARNING_URL || DATABASE_URL);
  return learningSql;
}

async function readTwinData() {
  const { data } = await (await getTwinStore()).readSnapshot();
  return useNeon ? deepParseJSONStrings(data) : data;
}

// ============================================
// Path helpers
// ============================================

function getByPath(obj, pathStr) {
  const parts = normalizePath(pathStr).split(".");
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
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
async function readDigitalTwin(pathArg, includeRevision) {
  const snapshot = await (await getTwinStore()).readSnapshot();
  const data = useNeon ? deepParseJSONStrings(snapshot.data) : snapshot.data;
  const result = readTwinValue(data, pathArg);
  const found = !pathArg || pathArg === "/" || pathArg === "." || getByPath(data, pathArg) !== undefined;
  return includeRevision === true && found ? { data: result, revision: snapshot.revision } : result;
}

function readTwinValue(data, pathArg) {

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
async function writeDigitalTwin(pathArg, value, expectedRevision) {
  return writeUserTwin(pathArg, value, {
    accessControl: ACCESS_CONTROL,
    store: await getTwinStore(),
    expectedRevision,
  });
}

// Create MCP server
const server = new Server(
  {
    name: "digital-twin-mcp-server",
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: STDIO_TOOLS }));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    if (name === "describe_by_path") {
      const result = await describeByPath(args.path);
      return {
        content: [{ type: "text", text: result }],
      };
    }

    if (name === "read_digital_twin") {
      const result = await readDigitalTwin(args.path, args.include_revision);
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
      const result = await writeDigitalTwin(args.path, args.data, args.expected_revision);
      if (result.success) {
        const userId = DT_USER_ID || "default";
        profileCache.invalidate(userId);
      }
      return {
        ...(result.error ? { isError: true } : {}),
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    // WP-151 Ф12: RCS profile tools
    if (name === "dt_get_profile_rcs") {
      const data = await readTwinData();
      const rcs = getByPath(data, "3_derived/rcs_profile") || null;
      return {
        content: [{ type: "text", text: JSON.stringify(rcs, null, 2) }],
      };
    }

    if (name === "dt_update_profile_rcs") {
      const { expected_revision: expectedRevision, ...fields } = args;
      const now = new Date().toISOString();
      const saved = await (await getTwinStore()).mutate((data) => {
        const existing = getByPath(data, "3_derived/rcs_profile") || {};
        const updated = {
          worldview: null, m1_focus: null, m2_iwe: null, m3_domain: null,
          m4_systems: null, it_level: null, agency: null, bottleneck: null,
          stage_derived: null, source: null,
          ...existing,
          ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
          updated_at: now,
        };
        setByPath(data, "3_derived/rcs_profile", updated);
        return updated;
      }, { expectedRevision });
      profileCache.invalidate(DT_USER_ID || "default");
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, rcs: saved.result, revision: saved.revision }) }],
      };
    }

    if (name === "dt_snapshot_rcs") {
      const timestamp = new Date().toISOString();
      const saved = await (await getTwinStore()).mutate((data) => {
        const rcs = getByPath(data, "3_derived/rcs_profile");
        if (!rcs) throw new TwinStoreError("profile_missing", "No rcs_profile found at 3_derived/rcs_profile");
        const snapshot = {
          timestamp,
          values: {
            W: rcs.worldview ?? null, M1: rcs.m1_focus ?? null, M2: rcs.m2_iwe ?? null,
            M3: rcs.m3_domain ?? null, M4: rcs.m4_systems ?? null,
            IT: rcs.it_level ?? null, A: rcs.agency ?? null,
          },
        };
        const history = [...(getByPath(data, "3_derived/rcs_history") || []), snapshot].slice(-52);
        setByPath(data, "3_derived/rcs_history", history);
        return { snapshot, history_length: history.length };
      }, { expectedRevision: args.expected_revision });
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, ...saved.result, revision: saved.revision }) }],
      };
    }

    // WP-318 Ф3: cp-profile from learning.cp_assessments
    if (name === "dt_get_cp_profile") {
      if (!DT_USER_ID) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "DT_USER_ID not configured" }) }],
          isError: true,
        };
      }
      if (!LEARNING_URL && !DATABASE_URL) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "LEARNING_URL not configured" }) }],
          isError: true,
        };
      }
      const onlyValid = args?.only_valid !== false;
      const sql = await getLearningSql();
      const rows = await sql`
        SELECT
          id, account_id, stage, bottleneck_slot,
          recommended_stream, skip_to_stage, cp_scores,
          source, interface, questions_count, rcs_version,
          assessed_at, valid_until
        FROM learning.cp_assessments
        WHERE account_id = ${DT_USER_ID}::uuid
        ORDER BY assessed_at DESC
        LIMIT 1
      `;
      if (rows.length === 0) {
        return { content: [{ type: "text", text: JSON.stringify(null) }] };
      }
      const row = rows[0];
      if (onlyValid && row.valid_until && new Date(row.valid_until) < new Date()) {
        return { content: [{ type: "text", text: JSON.stringify(null) }] };
      }
      const profile = {
        id: Number(row.id),
        stage: row.stage,
        bottleneck_slot: row.bottleneck_slot,
        recommended_stream: row.recommended_stream,
        skip_to_stage: row.skip_to_stage,
        cp_scores: row.cp_scores,
        source: row.source,
        interface: row.interface,
        questions_count: row.questions_count,
        rcs_version: row.rcs_version,
        assessed_at: row.assessed_at,
        valid_until: row.valid_until,
      };
      return { content: [{ type: "text", text: JSON.stringify(profile, null, 2) }] };
    }

    return {
      content: [{ type: "text", text: `Error: Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: error instanceof TwinStoreError ? JSON.stringify(storeErrorResult(error)) : `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const backend = useNeon ? `Neon (user: ${DT_USER_ID.substring(0, 8)}...)` : `file (${DATA_PATH})`;
  console.error(`Digital Twin MCP Server v${SERVER_VERSION} running on stdio [${backend}]`);
  console.error(`Tools: ${STDIO_TOOLS.map((tool) => tool.name).join(", ")}`);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
