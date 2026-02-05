/**
 * Digital Twin MCP Server - HTTP Transport
 * Tools: describe_by_path, read_digital_twin, write_digital_twin
 * Authentication: OAuth2 via Ory.sh (MCP spec compliant)
 */

import { METAMODEL, getGroup, getIndicator } from "./metamodel-data.js";

// ============================================
// OAuth2 / JWT Authentication (MCP Spec)
// ============================================

// JWKS cache
let jwksCache = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour

/**
 * Fetch JWKS from Ory
 */
async function getJwks(env) {
  const now = Date.now();
  if (jwksCache && (now - jwksCacheTime) < JWKS_CACHE_TTL) {
    return jwksCache;
  }

  const jwksUrl = `${env.ORY_PROJECT_URL}/.well-known/jwks.json`;
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }

  jwksCache = await response.json();
  jwksCacheTime = now;
  return jwksCache;
}

/**
 * Import JWK as CryptoKey
 */
async function importJwk(jwk) {
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

/**
 * Base64url decode
 */
function base64urlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

/**
 * Verify JWT signature and claims
 */
async function verifyJwt(token, env) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Invalid token format" };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    // Decode header and payload
    const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64)));
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: "Token expired" };
    }

    // Check not before
    if (payload.nbf && payload.nbf > now) {
      return { valid: false, error: "Token not yet valid" };
    }

    // Check issuer
    if (env.ORY_PROJECT_URL && payload.iss) {
      const expectedIssuer = env.ORY_PROJECT_URL.replace(/\/$/, "");
      if (!payload.iss.startsWith(expectedIssuer)) {
        return { valid: false, error: "Invalid issuer" };
      }
    }

    // Get JWKS and find matching key
    const jwks = await getJwks(env);
    const jwk = jwks.keys.find(k => k.kid === header.kid);
    if (!jwk) {
      return { valid: false, error: "Key not found" };
    }

    // Verify signature
    const key = await importJwk(jwk);
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64urlDecode(signatureB64);

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature,
      data
    );

    if (!valid) {
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true, claims: payload };
  } catch (err) {
    return { valid: false, error: `JWT verification failed: ${err.message}` };
  }
}

/**
 * Main authentication - verify Bearer token (JWT)
 */
async function authenticate(request, env) {
  // If no auth configured, allow all (dev mode)
  if (!env.ORY_PROJECT_URL) {
    return { valid: true, method: "none" };
  }

  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "missing_token" };
  }

  const token = authHeader.slice(7);
  const result = await verifyJwt(token, env);

  if (result.valid) {
    return { valid: true, method: "oauth2", claims: result.claims };
  }

  return { valid: false, error: result.error };
}

/**
 * Build WWW-Authenticate header for 401 responses
 */
function buildWwwAuthenticate(env, error = null) {
  const resourceUrl = env.RESOURCE_URL || "https://digital-twin-mcp.aisystant.workers.dev";
  let value = `Bearer resource="${resourceUrl}"`;
  if (error) {
    value += `, error="${error}"`;
  }
  return value;
}

// ============================================
// Twin Data Storage
// ============================================

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

// ============ HTTP Handler ============

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const resourceUrl = env.RESOURCE_URL || `${url.protocol}//${url.host}`;

    const cors = {
      "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // ======= OAuth2 Protected Resource Metadata (RFC 9728) =======
    if (url.pathname === "/.well-known/oauth-protected-resource") {
      if (!env.ORY_PROJECT_URL) {
        return new Response(JSON.stringify({ error: "OAuth not configured" }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const metadata = {
        resource: resourceUrl,
        authorization_servers: [env.ORY_PROJECT_URL],
        scopes_supported: ["openid", "offline_access"],
        bearer_methods_supported: ["header"],
        resource_documentation: `${resourceUrl}/docs`,
      };

      return new Response(JSON.stringify(metadata, null, 2), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Health check endpoint (no auth required)
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        auth: env.ORY_PROJECT_URL ? "oauth2" : "none",
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // MCP endpoint
    if (url.pathname === "/mcp" || url.pathname === "/") {
      // GET request - show server info (no auth for discovery)
      if (request.method !== "POST") {
        const info = {
          name: "digital-twin-mcp",
          version: "2.0.0",
          description: "Digital Twin MCP Server with OAuth2 authentication",
          auth: env.ORY_PROJECT_URL ? {
            type: "oauth2",
            metadata_url: `${resourceUrl}/.well-known/oauth-protected-resource`,
          } : { type: "none" },
          storage: env?.DIGITAL_TWIN_DATA ? "persistent" : "ephemeral",
          tools: tools.map(t => ({ name: t.name, description: t.description })),
        };

        return new Response(JSON.stringify(info, null, 2), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // POST request - requires authentication
      const authResult = await authenticate(request, env);

      if (!authResult.valid) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32001,
            message: "Unauthorized",
            data: { reason: authResult.error },
          },
        }), {
          status: 401,
          headers: {
            ...cors,
            "Content-Type": "application/json",
            "WWW-Authenticate": buildWwwAuthenticate(env, authResult.error),
          },
        });
      }

      const message = await request.json();
      const response = await handleMCP(env, message);

      return new Response(JSON.stringify(response, null, 2), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      error: "Not found",
      endpoints: ["/mcp", "/.well-known/oauth-protected-resource", "/health"],
    }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
