/**
 * Digital Twin MCP Server - Cloudflare Workers (HTTP Transport)
 *
 * Tools:
 * - describe_by_path: Get metamodel structure
 * - read_digital_twin: Read twin data
 * - write_digital_twin: Write twin data
 */

import { METAMODEL, getGroup, getIndicator } from "./metamodel-data.js";

// Default twin data (used when KV is empty)
const DEFAULT_TWIN_DATA = {
  indicators: {
    agency: {
      role_set: [],
      goals: [],
      daily_task_time: null,
    },
    data: {
      time_invested: { total_hours: 0, sessions_count: 0 },
      progress: {},
    },
    info: {
      profile: { name: "Learner", level: "beginner" },
      preferences: { style: "hands-on", pace: "moderate" },
    },
    stage: {
      current: "STG.Student.Practicing",
      history: [],
    },
  },
};

// KV key prefix for twin data
const TWIN_KEY_PREFIX = "twin:";
const DEFAULT_USER = "default";

// Get KV key for user
function getTwinKey(userId) {
  const safeUserId = (userId || DEFAULT_USER).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${TWIN_KEY_PREFIX}${safeUserId}`;
}

// Get twin data from KV (or default if not exists)
async function getTwinData(env, userId) {
  if (!env?.DIGITAL_TWIN_DATA) {
    return { ...DEFAULT_TWIN_DATA };
  }
  const key = getTwinKey(userId);
  const data = await env.DIGITAL_TWIN_DATA.get(key, "json");
  return data || { ...DEFAULT_TWIN_DATA };
}

// Save twin data to KV
async function saveTwinData(env, userId, data) {
  if (!env?.DIGITAL_TWIN_DATA) {
    return false;
  }
  const key = getTwinKey(userId);
  await env.DIGITAL_TWIN_DATA.put(key, JSON.stringify(data));
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

// Parse MD file to extract metadata
function parseMdFile(content, filename) {
  const lines = content.split("\n");
  const result = {
    name: filename,
    type: "unknown",
    format: "unknown",
    description: "",
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

  return result;
}

// ============ Tools ============

// Tool: describe_by_path - reads metamodel MD content
function describeByPath(pathArg) {
  // Handle empty or root path - list all groups
  if (!pathArg || pathArg === "/" || pathArg === ".") {
    const results = [];

    // List root files
    for (const [name, _content] of Object.entries(METAMODEL.rootFiles)) {
      results.push(`${name}:document:Root metamodel document`);
    }

    // List group folders
    for (const group of METAMODEL.groups) {
      const firstLine = group.description.split("\n").find((l) => l.startsWith("# "));
      const desc = firstLine ? firstLine.replace("# ", "").trim() : group.name;
      results.push(`${group.name}:group:${desc}`);
    }

    return results.join("\n");
  }

  const normalized = normalizePath(pathArg);
  const parts = normalized.split(".");

  // Check if it's a root file (stages, degrees)
  if (parts.length === 1 && METAMODEL.rootFiles[parts[0]]) {
    return METAMODEL.rootFiles[parts[0]];
  }

  // Check if it's a group
  const group = getGroup(parts[0]);
  if (!group) {
    return `Error: Path not found: ${pathArg}`;
  }

  // If just group name, list all indicators
  if (parts.length === 1) {
    const results = [];
    for (const [name, content] of Object.entries(group.indicators)) {
      const { type, format, description } = parseMdFile(content, name);
      results.push(`${name}:${type}/${format}:${description}`);
    }
    return results.join("\n");
  }

  // Get specific indicator
  const indicatorContent = getIndicator(parts[0], parts[1]);
  if (!indicatorContent) {
    return `Error: Indicator not found: ${pathArg}`;
  }

  return indicatorContent;
}

// Tool: read_digital_twin
async function readDigitalTwin(env, pathArg, userId) {
  const twinData = await getTwinData(env, userId);

  // If no path, return all data
  if (!pathArg || pathArg === "/" || pathArg === ".") {
    return twinData;
  }

  const value = getByPath(twinData, pathArg);
  if (value === undefined) return { error: `Path not found: ${pathArg}` };
  return value;
}

// Tool: write_digital_twin
async function writeDigitalTwin(env, pathArg, value, userId) {
  const twinData = await getTwinData(env, userId);
  setByPath(twinData, pathArg, value);
  const saved = await saveTwinData(env, userId, twinData);
  return {
    success: true,
    path: pathArg,
    value,
    user: userId || DEFAULT_USER,
    persisted: saved,
  };
}

// ============ MCP Protocol ============

// Tools schema
const tools = [
  {
    name: "describe_by_path",
    description:
      "Describe the digital twin metamodel structure. Returns field names, types, and descriptions for a given path. Use empty path or '/' to list all groups.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Path in metamodel. Examples: '/' (root), '01.preferences', '02.agency', '01.preferences/objective'",
        },
      },
    },
  },
  {
    name: "read_digital_twin",
    description: "Read data from the digital twin by path. Use dot notation for nested paths.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to data (e.g., 'indicators.agency.role_set', 'stage')",
        },
        user_id: {
          type: "string",
          description: "User ID (optional, defaults to 'default')",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_digital_twin",
    description: "Write data to the digital twin by path. Use dot notation for nested paths.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to data (e.g., 'indicators.agency.role_set', 'indicators.agency.goals')",
        },
        data: {
          description: "Data to write (any JSON value)",
        },
        user_id: {
          type: "string",
          description: "User ID (optional, defaults to 'default')",
        },
      },
      required: ["path", "data"],
    },
  },
];

// Handle tool calls
async function callTool(env, name, args) {
  switch (name) {
    case "describe_by_path":
      return describeByPath(args.path);
    case "read_digital_twin":
      return await readDigitalTwin(env, args.path, args.user_id);
    case "write_digital_twin":
      return await writeDigitalTwin(env, args.path, args.data, args.user_id);
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
          serverInfo: { name: "digital-twin-mcp", version: "2.0.0" },
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
          content: [
            { type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) },
          ],
        },
      };
    }

    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

// ============ Authentication ============

function checkAuth(request, env) {
  if (!env?.API_KEY) {
    return { authorized: true, mode: "open" };
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return { authorized: false, error: "Missing Authorization header" };
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return { authorized: false, error: "Invalid Authorization format. Use: Bearer <token>" };
  }

  if (token !== env.API_KEY) {
    return { authorized: false, error: "Invalid API key" };
  }

  return { authorized: true, mode: "protected" };
}

// ============ HTTP Handler ============

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // MCP endpoint
    if (url.pathname === "/mcp" || url.pathname === "/") {
      // GET - public info (no auth required)
      if (request.method !== "POST") {
        const authStatus = env?.API_KEY ? "enabled (use Bearer token)" : "disabled (open access)";
        return new Response(
          JSON.stringify(
            {
              info: "Digital Twin MCP Server v2.0",
              usage: "POST JSON-RPC to this endpoint",
              auth: authStatus,
              storage: env?.DIGITAL_TWIN_DATA ? "KV (persistent)" : "in-memory (non-persistent)",
              tools: tools.map((t) => ({ name: t.name, description: t.description })),
              metamodel: {
                groups: METAMODEL.groups.length,
                rootFiles: Object.keys(METAMODEL.rootFiles),
              },
            },
            null,
            2
          ),
          {
            headers: { ...cors, "Content-Type": "application/json" },
          }
        );
      }

      // POST - check auth if API_KEY is configured
      const auth = checkAuth(request, env);
      if (!auth.authorized) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: auth.error,
          }),
          {
            status: 401,
            headers: { ...cors, "Content-Type": "application/json" },
          }
        );
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
