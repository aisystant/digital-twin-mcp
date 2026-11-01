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
import { normalizePath, writeUserTwin } from "./twin-path.js";
import { createPostgresStore, TwinStoreError, storeErrorResult } from "./twin-store.js";
import { CORE_TOOLS as tools, SERVER_VERSION } from "./tool-catalog.js";

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

// Legacy path: the Gateway forwards the caller's Ory token. Ory tokens carry no audience
// for this server, so a token issued to any client of the project is accepted here.
async function verifyJwtLocally(oryUrl, token) {
  try {
    const jwks = getJwks(oryUrl);
    const issuer = oryUrl.endsWith("/") ? oryUrl : oryUrl + "/";
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

const MAX_BODY_BYTES = 1024 * 1024;
// Gateway assertion (gateway-mcp "assertion" backend auth, ADR-IWE-018): the Gateway mints a
// 60-second RS256 JWT per call, iss=iwe-gateway, aud=<backend audience>, sub=<user>,
// purpose=registry, and sends it in X-Gateway-Assertion. It cannot be obtained without
// passing the Gateway, and an Ory token issued to another client is not one.
const GATEWAY_ASSERTION_HEADER = "X-Gateway-Assertion";
const GATEWAY_ASSERTION_ISSUER = "iwe-gateway";
const GATEWAY_ASSERTION_AUDIENCE = "digital-twin-mcp";
const GATEWAY_ASSERTION_PURPOSE = "registry";

async function verifyGatewayAssertion(jwksUrl, assertion) {
  try {
    if (!_jwksCache.has(jwksUrl)) _jwksCache.set(jwksUrl, createRemoteJWKSet(new URL(jwksUrl)));
    const { payload } = await jwtVerify(assertion, _jwksCache.get(jwksUrl), {
      issuer: GATEWAY_ASSERTION_ISSUER,
      audience: GATEWAY_ASSERTION_AUDIENCE,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "exp", "iat"],
      maxTokenAge: "120s",
    });
    if (payload.purpose !== GATEWAY_ASSERTION_PURPOSE || typeof payload.sub !== "string" || !payload.sub) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

let warnedLegacyAuth = false;
function warnIfLegacyAuth(env) {
  if (warnedLegacyAuth || env.GATEWAY_JWKS_URL) return;
  warnedLegacyAuth = true;
  console.warn("[auth] GATEWAY_JWKS_URL is not set: forwarded Ory tokens are accepted, including direct calls bypassing the Gateway");
}

const unauthorized = (reason, headers = {}) => rpcErrorResponse(null, -32001, "Unauthorized", 401, { reason }, headers);
const invalidToken = (reason = "invalid_token") => unauthorized(reason, { "WWW-Authenticate": "Bearer error=\"invalid_token\"" });

// Returns { userId, via } (userId null for an anonymous caller) or { error: Response, via }.
async function authenticate(request, env) {
  if (env.GATEWAY_JWKS_URL) {
    const assertion = request.headers.get(GATEWAY_ASSERTION_HEADER);
    if (assertion === null) {
      return request.headers.get("Authorization") === null
        ? { userId: null, via: "anonymous" }
        : { error: unauthorized("gateway_assertion_required"), via: "rejected:gateway_assertion_required" };
    }
    const userId = await verifyGatewayAssertion(env.GATEWAY_JWKS_URL, assertion);
    return userId
      ? { userId, via: "gateway_assertion" }
      : { error: unauthorized("invalid_gateway_assertion"), via: "rejected:invalid_gateway_assertion" };
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader === null) return { userId: null, via: "anonymous" };
  if (!authHeader.startsWith("Bearer ")) return { error: invalidToken(), via: "rejected:invalid_token" };
  if (!env.ORY_URL) {
    console.error("[auth] ORY_URL not configured");
    return { error: unauthorized("auth_not_configured"), via: "rejected:auth_not_configured" };
  }
  const userId = await verifyJwtLocally(env.ORY_URL, authHeader.slice(7));
  return userId ? { userId, via: "ory_token" } : { error: invalidToken(), via: "rejected:invalid_token" };
}

// One line per MCP POST, without user identifiers, so the operator can see who still calls
// directly before GATEWAY_JWKS_URL is set. Cloudflare adds CF-Worker to subrequests made by
// Workers (the Gateway); a direct client such as the bot's own Digital Twin client has none.
function logAuth(request, via) {
  console.log(JSON.stringify({
    event: "mcp_auth",
    via,
    cf_worker: request.headers.get("CF-Worker"),
    has_gateway_assertion: request.headers.has(GATEWAY_ASSERTION_HEADER),
    has_x_user_id: request.headers.has("X-User-Id"),
    user_agent: (request.headers.get("User-Agent") ?? "").slice(0, 60) || null,
  }));
}

function rpcErrorResponse(id, code, message, status, data, headers = {}) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data && { data }) } }),
    { status, headers: { "Content-Type": "application/json", ...headers } });
}

async function readJsonBody(request) {
  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) {
    return { error: rpcErrorResponse(null, -32600, "Request too large", 413) };
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) return { error: rpcErrorResponse(null, -32600, "Request too large", 413) };
  let message;
  try {
    message = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { error: rpcErrorResponse(null, -32700, "Parse error", 400) };
  }
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    return { error: rpcErrorResponse(null, -32600, "Invalid Request", 400) };
  }
  return { message };
}

// ============================================
// Twin Data Storage
// ============================================

function getTwinStore(env, userId) {
  if (!env.DATABASE_URL) throw new TwinStoreError("storage_unavailable", "Digital twin database is not configured");
  // Preserve the cloud search_path binding; local indicators is a separate configuration.
  return createPostgresStore(neon(env.DATABASE_URL), userId);
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

async function readDigitalTwin(env, pathArg, userId, includeRevision) {
  const snapshot = await getTwinStore(env, userId).readSnapshot();
  const result = readTwinValue(snapshot.data, pathArg);
  const found = !pathArg || pathArg === "/" || pathArg === "." || getByPath(snapshot.data, pathArg) !== undefined;
  return includeRevision === true && found ? { data: result, revision: snapshot.revision } : result;
}

function readTwinValue(twinData, pathArg) {
  if (!pathArg || pathArg === "/" || pathArg === ".") return deepParseJSONStrings(twinData);
  const value = getByPath(twinData, pathArg);
  if (value === undefined) return { error: `Path not found: ${pathArg}` };
  if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
    try { return JSON.parse(value); } catch {}
  }
  if (typeof value === "object" && value !== null) return deepParseJSONStrings(value);
  return value;
}

// A string holding a JSON object or array is stored as the structure it encodes (clients that
// stringify structured values). Every other string stays text: "42", "true" and "null" are
// not numbers, booleans or a cleared value.
function decodeStructuredString(value) {
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed !== null && typeof parsed === "object" ? parsed : value;
  } catch {
    return value;
  }
}

async function writeDigitalTwin(env, pathArg, value, userId, expectedRevision) {
  const parsedValue = decodeStructuredString(value);
  const result = await writeUserTwin(pathArg, parsedValue, {
    accessControl: METAMODEL.accessControl,
    store: { mutate: (...args) => getTwinStore(env, userId).mutate(...args) },
    expectedRevision,
  });
  return result.error ? result : { ...result, user: userId || "anonymous" };
}

// ============ MCP Protocol ============

async function callTool(env, name, args, userId) {
  switch (name) {
    case "describe_by_path": return describeByPath(args.path);
    case "read_digital_twin": return await readDigitalTwin(env, args.path, userId, args.include_revision);
    case "write_digital_twin": return await writeDigitalTwin(env, args.path, args.data, userId, args.expected_revision);
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
          serverInfo: { name: "digital-twin-mcp", version: SERVER_VERSION },
        },
      };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools } };
    case "tools/call": {
      if (params === null || typeof params !== "object" || typeof params.name !== "string") {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid params: tools/call requires params.name" } };
      }
      const { name, arguments: args } = params;
      let result;
      try {
        result = await callTool(env, name, args || {}, userId);
      } catch (error) {
        result = storeErrorResult(error);
      }
      if (result?.error && typeof result.error === "string") {
        return {
          jsonrpc: "2.0", id,
          error: {
            code: -32000, message: result.error,
            ...(result.code && { data: {
              code: result.code,
              ...(result.current_revision && { current_revision: result.current_revision }),
            } }),
          },
        };
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

    console.log(`[${request.method}] ${url.pathname}`);

    // CORS: Allow-Credentials requires a specific origin (not "*") per W3C CORS spec.
    // If CORS_ORIGIN is not set, omit Credentials header to remain spec-compliant.
    const corsOrigin = env.CORS_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...(corsOrigin !== "*" ? { "Access-Control-Allow-Credentials": "true" } : {}),
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    function withCors(response) {
      const newHeaders = new Headers(response.headers);
      for (const [k, v] of Object.entries(cors)) newHeaders.set(k, v);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: newHeaders });
    }

    // Health check
    if (url.pathname === "/health") {
      return withCors(jsonResponse({
        status: "ok", auth: "jwt-jwks", version: SERVER_VERSION,
        // Shows an unfinished rollout: "off" means direct calls with an Ory token are still accepted.
        gateway_assertion: env.GATEWAY_JWKS_URL ? "enforced" : "off",
      }));
    }

    // MCP endpoint
    if (url.pathname === "/mcp" || url.pathname === "/") {
      if (request.method !== "POST") {
        return withCors(jsonResponse({
          name: "digital-twin-mcp",
          version: SERVER_VERSION,
          description: "Digital Twin MCP Server — JWT auth via Ory JWKS",
          storage: env?.DATABASE_URL ? "persistent" : "unavailable",
          tools: tools.map(t => ({ name: t.name, description: t.description })),
        }));
      }

      warnIfLegacyAuth(env);

      // Credentials are verified before the body is parsed, so an unauthenticated
      // caller only reaches the guarded parser and the public tools/list.
      const auth = await authenticate(request, env);
      logAuth(request, auth.via);
      if (auth.error) return withCors(auth.error);
      const userId = auth.userId;

      const body = await readJsonBody(request);
      if (body.error) return withCors(body.error);
      const message = body.message;

      // tools/list is public — allows Gateway to discover tools
      if (!userId && message.method !== "tools/list") {
        return withCors(rpcErrorResponse(message.id, -32001, "Unauthorized", 401, { reason: "missing_token" },
          { "WWW-Authenticate": "Bearer" }));
      }

      // Subscription check delegated to Gateway (ADR-IWE-012): backends trust Gateway.
      // With GATEWAY_JWKS_URL set, that trust is enforced by the Gateway assertion.

      const response = await handleMCP(env, message, userId);
      return withCors(jsonResponse(response));
    }

    return withCors(jsonResponse({ error: "Not found", endpoints: ["/mcp", "/health"] }, 404));
  },
};
