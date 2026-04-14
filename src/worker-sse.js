/**
 * Digital Twin MCP Server - HTTP Transport
 * Tools: describe_by_path, read_digital_twin, write_digital_twin
 *
 * Authentication: JWT verification via Ory JWKS (ADR-IWE-012, B4.21 WP-212).
 * Each request verifies Bearer token locally — no OAuth2 AS, no KV tokens.
 * see DP.D.031, ADR-IWE-012
 */

import { neon } from "@neondatabase/serverless";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { METAMODEL, getGroup, getIndicator } from "./metamodel-data.js";

// ============================================
// JWT Verification (ADR-IWE-012)
// ============================================

const _jwksCache = new Map();

function getJwks(oryUrl) {
  if (!_jwksCache.has(oryUrl)) {
    const jwksUrl = new URL(`${oryUrl}/.well-known/jwks.json`);
    _jwksCache.set(oryUrl, createRemoteJWKSet(jwksUrl));
  }
  return _jwksCache.get(oryUrl);
}

async function verifyJwtLocally(oryUrl, token) {
  try {
    const jwks = getJwks(oryUrl);
    const issuer = oryUrl.replace("/hydra", "") + "/";
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      algorithms: ["RS256"],
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// ============================================
// Subscription Check (DP.SC.112)
// ============================================

async function checkSubscription(databaseUrl, oryId) {
  try {
    const sql = neon(databaseUrl);
    const [row] = await sql`
      SELECT EXISTS (
        SELECT 1 FROM subscription_grants
        WHERE ory_id = ${oryId}
          AND (valid_until IS NULL OR valid_until > now())
          AND revoked_at IS NULL
      ) AS has_subscription
    `;
    return row?.has_subscription === true;
  } catch {
    return false;
  }
}

// ============================================
// Helpers
// ============================================

function mask(value, visibleChars = 6) {
  if (!value) return "(not set)";
  const str = String(value);
  if (str.length <= visibleChars) return str;
  return str.substring(0, visibleChars) + "...";
}

// ============================================
// Twin Data Storage
// ============================================

async function getTwinData(env, userId) {
  if (!env.DATABASE_URL) return {};
  const sql = neon(env.DATABASE_URL);
  const rows = await sql`SELECT data FROM digital_twins WHERE user_id = ${userId}`;
  return rows.length ? rows[0].data : {};
}

async function saveTwinData(env, userId, data) {
  if (!env.DATABASE_URL) return false;
  const sql = neon(env.DATABASE_URL);
  await sql`
    INSERT INTO digital_twins (user_id, data, updated_at)
    VALUES (${userId}, ${JSON.stringify(data)}, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET data = EXCLUDED.data, updated_at = NOW()
  `;
  return true;
}

function normalizePath(p) {
  return p.replace(/\//g, ".").replace(/^\.+|\.+$/g, "");
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
    if (!(parts[i] in current)) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

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

function parseMdFile(content, filename) {
  const lines = content.split("\n");
  const result = { name: filename, type: "unknown", format: "unknown", description: "" };
  for (const line of lines) {
    if (line.startsWith("**Name:**")) result.name = line.replace("**Name:**", "").trim();
    if (line.startsWith("**Type:**")) result.type = line.replace("**Type:**", "").trim();
    if (line.startsWith("**Format:**")) result.format = line.replace("**Format:**", "").trim();
    if (line.startsWith("**Description:**")) result.description = line.replace("**Description:**", "").trim();
  }
  return result;
}

// ============ Tools ============

function describeByPath(pathArg) {
  if (!pathArg || pathArg === "/" || pathArg === ".") {
    const results = [];
    for (const [name] of Object.entries(METAMODEL.rootFiles)) {
      results.push(`${name}:document:Shared metamodel document`);
    }
    for (const cat of METAMODEL.categories) {
      const firstLine = cat.description.split("\n").find((l) => l.startsWith("# "));
      const desc = firstLine ? firstLine.replace("# ", "").trim() : cat.name;
      const count = cat.subgroups.reduce((sum, s) => sum + Object.keys(s.indicators).length, 0);
      results.push(`${cat.name}:category:${desc} (${count} indicators)`);
    }
    return results.join("\n");
  }

  const normalized = normalizePath(pathArg);
  const parts = normalized.split(".");

  if (parts.length === 1) {
    if (METAMODEL.rootFiles[parts[0]]) return METAMODEL.rootFiles[parts[0]];
    const category = METAMODEL.categories.find(c => c.name === parts[0]);
    if (category) {
      const results = [];
      for (const sub of category.subgroups) {
        const count = Object.keys(sub.indicators).length;
        const suffix = count > 0 ? ` (${count} indicators)` : "";
        results.push(`${sub.name}:subgroup${suffix}`);
      }
      return category.description + "\n---\n" + results.join("\n");
    }
    return `Error: Path not found: ${pathArg}`;
  }

  if (parts.length === 2) {
    const groupPath = `${parts[0]}/${parts[1]}`;
    const group = getGroup(groupPath);
    if (!group) return `Error: Subgroup not found: ${pathArg}`;
    const results = [];
    for (const [name, content] of Object.entries(group.indicators)) {
      const { type, format, description } = parseMdFile(content, name);
      results.push(`${name}:${type}/${format}:${description}`);
    }
    if (results.length === 0) return `Subgroup '${pathArg}' exists but has no indicators yet.`;
    return results.join("\n");
  }

  const groupPath = `${parts[0]}/${parts[1]}`;
  const indicatorName = parts[2];
  const indicatorContent = getIndicator(groupPath, indicatorName);
  if (!indicatorContent) return `Error: Indicator not found: ${pathArg}`;
  return indicatorContent;
}

async function readDigitalTwin(env, pathArg, userId) {
  const twinData = await getTwinData(env, userId);
  if (!pathArg || pathArg === "/" || pathArg === ".") return deepParseJSONStrings(twinData);
  const value = getByPath(twinData, pathArg);
  if (value === undefined) return { error: `Path not found: ${pathArg}` };
  if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
    try { return JSON.parse(value); } catch {}
  }
  if (typeof value === "object" && value !== null) return deepParseJSONStrings(value);
  return value;
}

async function writeDigitalTwin(env, pathArg, value, userId) {
  const parts = normalizePath(pathArg).split(".");
  const category = parts[0];
  const access = METAMODEL.accessControl?.[category];
  if (access && !access.user?.includes("w")) {
    return { error: `Write access denied. Category '${category}' is read-only for users.` };
  }
  let parsedValue = value;
  if (typeof value === "string") {
    try { parsedValue = JSON.parse(value); } catch {}
  }
  const twinData = await getTwinData(env, userId);
  setByPath(twinData, pathArg, parsedValue);
  const saved = await saveTwinData(env, userId, twinData);
  return { success: true, path: pathArg, value: parsedValue, user: userId || "anonymous", persisted: saved };
}

// ============ MCP Protocol ============

const tools = [
  {
    name: "describe_by_path",
    description: "Describe the digital twin metamodel structure. Returns field names, types, and descriptions for a given path. Use empty path or '/' to list all categories.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path in metamodel. Examples: '/' (root), '1_declarative', '1_declarative/1_2_goals', '1_declarative/1_2_goals/09_Цели обучения'",
        },
      },
    },
  },
  {
    name: "read_digital_twin",
    description: "Read data from the authenticated user's digital twin by path. Use dot or slash notation for nested paths.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to data (e.g., '1_declarative/1_2_goals/09_Цели обучения')" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_digital_twin",
    description: "Write data to the authenticated user's digital twin by path. Only '1_declarative' category is writable by users.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to data" },
        data: { description: "Data to write (any JSON value)" },
      },
      required: ["path", "data"],
    },
  },
];

async function callTool(env, name, args, userId) {
  switch (name) {
    case "describe_by_path": return describeByPath(args.path);
    case "read_digital_twin": return await readDigitalTwin(env, args.path, userId);
    case "write_digital_twin": return await writeDigitalTwin(env, args.path, args.data, userId);
    default: return { error: `Unknown tool: ${name}` };
  }
}

async function handleMCP(env, message, userId) {
  const { jsonrpc, id, method, params } = message;
  if (jsonrpc !== "2.0") return { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid Request" } };

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "digital-twin-mcp", version: "3.0.0" },
        },
      };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools } };
    case "tools/call": {
      const { name, arguments: args } = params;
      const result = await callTool(env, name, args || {}, userId);
      if (result?.error && typeof result.error === "string") {
        return { jsonrpc: "2.0", id, error: { code: -32000, message: result.error } };
      }
      return {
        jsonrpc: "2.0", id,
        result: {
          content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        },
      };
    }
    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

// ============ Helpers ============

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

// ============ HTTP Handler ============

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    console.log(`\n========== [${request.method}] ${url.pathname} ==========`);
    console.log("[env] ORY_URL:", mask(env.ORY_URL, 20));
    console.log("[env] DATABASE_URL:", mask(env.DATABASE_URL, 15));

    const cors = {
      "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    function withCors(response) {
      const newHeaders = new Headers(response.headers);
      for (const [k, v] of Object.entries(cors)) newHeaders.set(k, v);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: newHeaders });
    }

    // Health check
    if (url.pathname === "/health") {
      return withCors(jsonResponse({ status: "ok", auth: "jwt-jwks" }));
    }

    // MCP endpoint
    if (url.pathname === "/mcp" || url.pathname === "/") {
      if (request.method !== "POST") {
        return withCors(jsonResponse({
          name: "digital-twin-mcp",
          version: "3.0.0",
          description: "Digital Twin MCP Server — JWT auth via Ory JWKS",
          storage: env?.DATABASE_URL ? "persistent" : "ephemeral",
          tools: tools.map(t => ({ name: t.name, description: t.description })),
        }));
      }

      const message = await request.json();

      // tools/list is public — allows Gateway to discover tools
      if (message.method === "tools/list") {
        const response = await handleMCP(env, message, null);
        return withCors(jsonResponse(response));
      }

      // All other methods require authentication (ADR-IWE-012)
      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return withCors(new Response(JSON.stringify({
          jsonrpc: "2.0", id: message.id ?? null,
          error: { code: -32001, message: "Unauthorized", data: { reason: "missing_token" } },
        }), { status: 401, headers: { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" } }));
      }

      if (!env.ORY_URL) {
        console.error("[auth] ORY_URL not configured");
        return withCors(new Response(JSON.stringify({
          jsonrpc: "2.0", id: message.id ?? null,
          error: { code: -32001, message: "Unauthorized", data: { reason: "auth_not_configured" } },
        }), { status: 401, headers: { "Content-Type": "application/json" } }));
      }

      const token = authHeader.slice(7);
      const userId = await verifyJwtLocally(env.ORY_URL, token);

      if (!userId) {
        return withCors(new Response(JSON.stringify({
          jsonrpc: "2.0", id: message.id ?? null,
          error: { code: -32001, message: "Unauthorized", data: { reason: "invalid_token" } },
        }), { status: 401, headers: { "Content-Type": "application/json", "WWW-Authenticate": "Bearer error=\"invalid_token\"" } }));
      }

      // Subscription check (DP.SC.112)
      if (env.DATABASE_URL) {
        const hasSub = await checkSubscription(env.DATABASE_URL, userId);
        if (!hasSub) {
          return withCors(new Response(JSON.stringify({
            jsonrpc: "2.0", id: message.id ?? null,
            error: { code: -32001, message: "Forbidden", data: { reason: "subscription_required" } },
          }), { status: 403, headers: { "Content-Type": "application/json" } }));
        }
      }

      const response = await handleMCP(env, message, userId);
      return withCors(jsonResponse(response));
    }

    return withCors(jsonResponse({ error: "Not found", endpoints: ["/mcp", "/health"] }, 404));
  },
};
