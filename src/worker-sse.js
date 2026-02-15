/**
 * Digital Twin MCP Server - HTTP Transport
 * Tools: describe_by_path, read_digital_twin, write_digital_twin
 * Authentication: OAuth2 Authorization Server (MCP spec compliant)
 *   - Delegates user authentication to Ory.sh
 *   - Dynamic client registration (RFC 7591)
 *   - PKCE support (RFC 7636)
 */

import { neon } from "@neondatabase/serverless";
import { METAMODEL, getGroup, getIndicator } from "./metamodel-data.js";

// ============================================
// OAuth2 Authorization Server - Crypto Helpers
// ============================================

function generateRandomString(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function base64urlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(plain) {
  const data = new TextEncoder().encode(plain);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(hash);
}

// ============================================
// OAuth2 Authorization Server - KV Storage
// ============================================

// Key patterns and TTLs:
//   oauth:client:{id}       - client registration (permanent)
//   oauth:code:{code}       - auth code + PKCE + user_id (5 min)
//   oauth:token:{token}     - access token + user_id (1 hour)
//   oauth:refresh:{token}   - refresh token + user_id + ory_refresh (30 days)
//   oauth:state:{state}     - pending auth state (10 min)

const TTL = {
  CODE: 300,          // 5 minutes
  TOKEN: 3600,        // 1 hour
  REFRESH: 2592000,   // 30 days
  STATE: 600,         // 10 minutes
};

async function kvPut(env, key, value, ttl) {
  const opts = ttl ? { expirationTtl: ttl } : {};
  await env.DIGITAL_TWIN_DATA.put(key, JSON.stringify(value), opts);
}

async function kvGet(env, key) {
  return await env.DIGITAL_TWIN_DATA.get(key, "json");
}

async function kvDelete(env, key) {
  await env.DIGITAL_TWIN_DATA.delete(key);
}

// ============================================
// OAuth2 Authorization Server - Endpoints
// ============================================

function getBaseUrl(env, request) {
  if (env.RESOURCE_URL) return env.RESOURCE_URL.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

/**
 * GET /.well-known/oauth-authorization-server
 * Authorization Server Metadata (RFC 8414)
 */
function handleASMetadata(baseUrl) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    registration_endpoint: `${baseUrl}/register`,
    scopes_supported: ["openid", "offline_access"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
  };
}

/**
 * POST /register
 * Dynamic Client Registration (RFC 7591)
 */
async function handleRegister(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request", error_description: "Invalid JSON body" }, 400);
  }

  const clientId = generateRandomString(16);
  const clientData = {
    client_id: clientId,
    client_name: body.client_name || "Unknown Client",
    redirect_uris: body.redirect_uris || [],
    grant_types: body.grant_types || ["authorization_code"],
    response_types: body.response_types || ["code"],
    token_endpoint_auth_method: body.token_endpoint_auth_method || "none",
    created_at: Date.now(),
  };

  if (!clientData.redirect_uris.length) {
    return jsonResponse({
      error: "invalid_client_metadata",
      error_description: "redirect_uris is required",
    }, 400);
  }

  await kvPut(env, `oauth:client:${clientId}`, clientData);

  return jsonResponse({
    client_id: clientId,
    client_name: clientData.client_name,
    redirect_uris: clientData.redirect_uris,
    grant_types: clientData.grant_types,
    response_types: clientData.response_types,
    token_endpoint_auth_method: clientData.token_endpoint_auth_method,
  }, 201);
}

/**
 * GET /authorize
 * Stores PKCE state, redirects to Ory /oauth2/auth
 */
async function handleAuthorize(request, env, baseUrl) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const scope = url.searchParams.get("scope") || "openid offline_access";

  if (!clientId || !redirectUri || !codeChallenge) {
    return jsonResponse({
      error: "invalid_request",
      error_description: "client_id, redirect_uri, and code_challenge are required",
    }, 400);
  }

  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    return jsonResponse({
      error: "invalid_request",
      error_description: "Only S256 code_challenge_method is supported",
    }, 400);
  }

  // Validate client
  const client = await kvGet(env, `oauth:client:${clientId}`);
  if (!client) {
    return jsonResponse({ error: "invalid_client", error_description: "Unknown client_id" }, 400);
  }

  if (!client.redirect_uris.includes(redirectUri)) {
    return jsonResponse({
      error: "invalid_request",
      error_description: "redirect_uri not registered for this client",
    }, 400);
  }

  // Generate internal state to link Ory callback back to this request
  const internalState = generateRandomString(32);
  await kvPut(env, `oauth:state:${internalState}`, {
    client_id: clientId,
    redirect_uri: redirectUri,
    client_state: state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod || "S256",
    scope,
    created_at: Date.now(),
  }, TTL.STATE);

  console.log("[authorize] client_id:", clientId, "redirect_uri:", redirectUri, "baseUrl:", baseUrl);

  // Redirect to Ory authorization endpoint
  const oryAuthUrl = new URL(`${env.ORY_PROJECT_URL}/oauth2/auth`);
  oryAuthUrl.searchParams.set("client_id", env.ORY_CLIENT_ID);
  oryAuthUrl.searchParams.set("response_type", "code");
  oryAuthUrl.searchParams.set("redirect_uri", `${baseUrl}/callback`);
  oryAuthUrl.searchParams.set("scope", "openid offline_access");
  oryAuthUrl.searchParams.set("state", internalState);

  return new Response(null, {
    status: 302,
    headers: { Location: oryAuthUrl.toString() },
  });
}

/**
 * GET /callback
 * Handles Ory redirect, exchanges Ory code for token, issues MCP auth code
 */
async function handleCallback(request, env, baseUrl) {
  const url = new URL(request.url);
  const oryCode = url.searchParams.get("code");
  const internalState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  console.log("[callback] received:", { hasCode: !!oryCode, hasState: !!internalState, error, baseUrl });

  if (error) {
    const errorDesc = url.searchParams.get("error_description") || "Authorization denied";
    return new Response(`Authorization failed: ${errorDesc}`, { status: 400 });
  }

  if (!oryCode || !internalState) {
    return new Response("Missing code or state parameter", { status: 400 });
  }

  // Retrieve pending auth state
  const pendingState = await kvGet(env, `oauth:state:${internalState}`);
  if (!pendingState) {
    console.error("[callback] state not found in KV:", internalState);
    return new Response("Invalid or expired state", { status: 400 });
  }

  console.log("[callback] pending state found, client_id:", pendingState.client_id, "redirect_uri:", pendingState.redirect_uri);

  // Clean up state
  await kvDelete(env, `oauth:state:${internalState}`);

  // Exchange Ory code for Ory token
  const oryCallbackUri = `${baseUrl}/callback`;
  console.log("[callback] exchanging Ory code, redirect_uri:", oryCallbackUri, "ORY_CLIENT_ID:", env.ORY_CLIENT_ID, "hasSecret:", !!env.ORY_CLIENT_SECRET);

  let oryTokenData;
  try {
    const tokenResponse = await fetch(`${env.ORY_PROJECT_URL}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: oryCode,
        redirect_uri: oryCallbackUri,
        client_id: env.ORY_CLIENT_ID,
        client_secret: env.ORY_CLIENT_SECRET,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error("[callback] Ory token exchange failed:", tokenResponse.status, errBody);
      return new Response(`Failed to exchange authorization code: ${errBody}`, { status: 502 });
    }

    oryTokenData = await tokenResponse.json();
    console.log("[callback] Ory token received, has id_token:", !!oryTokenData.id_token, "has refresh:", !!oryTokenData.refresh_token);
  } catch (err) {
    console.error("[callback] Ory token exchange error:", err);
    return new Response("Failed to exchange authorization code", { status: 502 });
  }

  // Extract user identity from Ory ID token or access token
  let userId;
  if (oryTokenData.id_token) {
    // Decode JWT payload (we trust Ory, no signature verification needed for sub extraction)
    try {
      const parts = oryTokenData.id_token.split(".");
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      userId = payload.sub;
    } catch {
      console.error("Failed to decode Ory id_token");
    }
  }

  if (!userId) {
    // Fallback: use userinfo endpoint
    try {
      const userinfoResp = await fetch(`${env.ORY_PROJECT_URL}/userinfo`, {
        headers: { Authorization: `Bearer ${oryTokenData.access_token}` },
      });
      if (userinfoResp.ok) {
        const userinfo = await userinfoResp.json();
        userId = userinfo.sub;
      }
    } catch {
      console.error("Failed to fetch userinfo from Ory");
    }
  }

  if (!userId) {
    console.error("[callback] failed to extract userId from Ory tokens");
    return new Response("Failed to identify user", { status: 502 });
  }

  console.log("[callback] userId extracted:", userId);

  // Generate MCP authorization code
  const mcpCode = generateRandomString(32);
  await kvPut(env, `oauth:code:${mcpCode}`, {
    client_id: pendingState.client_id,
    redirect_uri: pendingState.redirect_uri,
    code_challenge: pendingState.code_challenge,
    code_challenge_method: pendingState.code_challenge_method,
    user_id: userId,
    ory_refresh_token: oryTokenData.refresh_token || null,
    created_at: Date.now(),
  }, TTL.CODE);

  // Redirect back to client with MCP auth code
  const redirectUrl = new URL(pendingState.redirect_uri);
  redirectUrl.searchParams.set("code", mcpCode);
  if (pendingState.client_state) {
    redirectUrl.searchParams.set("state", pendingState.client_state);
  }

  console.log("[callback] redirecting to client:", redirectUrl.toString().substring(0, 100));

  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl.toString() },
  });
}

/**
 * POST /token
 * Token exchange (authorization_code + PKCE) and refresh_token grant
 */
async function handleToken(request, env) {
  let body;
  try {
    const text = await request.text();
    console.log("[token] raw body:", text.substring(0, 200));
    body = Object.fromEntries(new URLSearchParams(text));
  } catch (err) {
    console.error("[token] body parse error:", err);
    return jsonResponse({ error: "invalid_request", error_description: "Invalid request body" }, 400);
  }

  const grantType = body.grant_type;
  console.log("[token] grant_type:", grantType, "client_id:", body.client_id, "has code:", !!body.code, "has code_verifier:", !!body.code_verifier);

  if (grantType === "authorization_code") {
    return handleAuthorizationCodeGrant(body, env);
  } else if (grantType === "refresh_token") {
    return handleRefreshTokenGrant(body, env);
  } else {
    return jsonResponse({ error: "unsupported_grant_type" }, 400);
  }
}

async function handleAuthorizationCodeGrant(body, env) {
  const { code, code_verifier, client_id, redirect_uri } = body;

  if (!code || !code_verifier || !client_id) {
    console.error("[token] missing params:", { hasCode: !!code, hasVerifier: !!code_verifier, hasClientId: !!client_id });
    return jsonResponse({
      error: "invalid_request",
      error_description: "code, code_verifier, and client_id are required",
    }, 400);
  }

  // Retrieve and validate auth code
  const codeData = await kvGet(env, `oauth:code:${code}`);
  if (!codeData) {
    console.error("[token] code not found in KV:", code.substring(0, 8) + "...");
    return jsonResponse({ error: "invalid_grant", error_description: "Invalid or expired code" }, 400);
  }

  console.log("[token] code found, client_id match:", codeData.client_id === client_id, "user_id:", codeData.user_id);

  // Delete code (single use)
  await kvDelete(env, `oauth:code:${code}`);

  // Validate client_id
  if (codeData.client_id !== client_id) {
    console.error("[token] client_id mismatch:", codeData.client_id, "vs", client_id);
    return jsonResponse({ error: "invalid_grant", error_description: "client_id mismatch" }, 400);
  }

  // Validate redirect_uri if provided
  if (redirect_uri && codeData.redirect_uri !== redirect_uri) {
    console.error("[token] redirect_uri mismatch:", codeData.redirect_uri, "vs", redirect_uri);
    return jsonResponse({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
  }

  // Validate PKCE
  const computedChallenge = await sha256(code_verifier);
  if (computedChallenge !== codeData.code_challenge) {
    console.error("[token] PKCE failed. computed:", computedChallenge, "expected:", codeData.code_challenge);
    return jsonResponse({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
  }

  console.log("[token] PKCE verified, issuing tokens for user:", codeData.user_id);

  // Issue MCP tokens
  const accessToken = generateRandomString(32);
  const refreshToken = generateRandomString(32);

  await kvPut(env, `oauth:token:${accessToken}`, {
    user_id: codeData.user_id,
    client_id,
    scope: "openid offline_access",
    created_at: Date.now(),
  }, TTL.TOKEN);

  await kvPut(env, `oauth:refresh:${refreshToken}`, {
    user_id: codeData.user_id,
    client_id,
    ory_refresh_token: codeData.ory_refresh_token,
    scope: "openid offline_access",
    created_at: Date.now(),
  }, TTL.REFRESH);

  return jsonResponse({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: TTL.TOKEN,
    refresh_token: refreshToken,
    scope: "openid offline_access",
  });
}

async function handleRefreshTokenGrant(body, env) {
  const { refresh_token, client_id } = body;

  if (!refresh_token || !client_id) {
    return jsonResponse({
      error: "invalid_request",
      error_description: "refresh_token and client_id are required",
    }, 400);
  }

  const refreshData = await kvGet(env, `oauth:refresh:${refresh_token}`);
  if (!refreshData) {
    return jsonResponse({ error: "invalid_grant", error_description: "Invalid or expired refresh token" }, 400);
  }

  if (refreshData.client_id !== client_id) {
    return jsonResponse({ error: "invalid_grant", error_description: "client_id mismatch" }, 400);
  }

  // Delete old refresh token (rotation)
  await kvDelete(env, `oauth:refresh:${refresh_token}`);

  // Issue new tokens
  const newAccessToken = generateRandomString(32);
  const newRefreshToken = generateRandomString(32);

  await kvPut(env, `oauth:token:${newAccessToken}`, {
    user_id: refreshData.user_id,
    client_id,
    scope: refreshData.scope || "openid offline_access",
    created_at: Date.now(),
  }, TTL.TOKEN);

  await kvPut(env, `oauth:refresh:${newRefreshToken}`, {
    user_id: refreshData.user_id,
    client_id,
    ory_refresh_token: refreshData.ory_refresh_token,
    scope: refreshData.scope || "openid offline_access",
    created_at: Date.now(),
  }, TTL.REFRESH);

  return jsonResponse({
    access_token: newAccessToken,
    token_type: "Bearer",
    expires_in: TTL.TOKEN,
    refresh_token: newRefreshToken,
    scope: refreshData.scope || "openid offline_access",
  });
}

// ============================================
// Authentication - KV Token Lookup
// ============================================

async function authenticate(request, env) {
  // If no DATABASE_URL configured, allow all (dev mode)
  if (!env?.DATABASE_URL) {
    return { valid: true, userId: null };
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "missing_token" };
  }

  const token = authHeader.slice(7);
  const tokenData = await kvGet(env, `oauth:token:${token}`);

  if (!tokenData) {
    return { valid: false, error: "invalid_token" };
  }

  return { valid: true, userId: tokenData.user_id };
}

function buildWwwAuthenticate(baseUrl, error = null) {
  let value = `Bearer resource="${baseUrl}"`;
  if (error) {
    value += `, error="${error}"`;
  }
  return value;
}

// ============================================
// Twin Data Storage
// ============================================

// Auto-migration: creates table on first use per isolate
let _migrated = false;
async function ensureTable(sql) {
  if (_migrated) return;
  await sql`
    CREATE TABLE IF NOT EXISTS digital_twins (
      user_id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  _migrated = true;
}

async function getTwinData(env, userId) {
  if (!env.DATABASE_URL) return {};
  const sql = neon(env.DATABASE_URL);
  await ensureTable(sql);
  const rows = await sql`SELECT data FROM digital_twins WHERE user_id = ${userId}`;
  return rows.length ? rows[0].data : {};
}

async function saveTwinData(env, userId, data) {
  if (!env.DATABASE_URL) return false;
  const sql = neon(env.DATABASE_URL);
  await ensureTable(sql);
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

function describeByPath(pathArg) {
  // Root: list categories + shared documents
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

  // 1 segment: rootFile or category
  if (parts.length === 1) {
    if (METAMODEL.rootFiles[parts[0]]) {
      return METAMODEL.rootFiles[parts[0]];
    }

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

  // 2 segments: category/subgroup → list indicators
  if (parts.length === 2) {
    const groupPath = `${parts[0]}/${parts[1]}`;
    const group = getGroup(groupPath);
    if (!group) {
      return `Error: Subgroup not found: ${pathArg}`;
    }

    const results = [];
    for (const [name, content] of Object.entries(group.indicators)) {
      const { type, format, description } = parseMdFile(content, name);
      results.push(`${name}:${type}/${format}:${description}`);
    }

    if (results.length === 0) {
      return `Subgroup '${pathArg}' exists but has no indicators yet.`;
    }

    return results.join("\n");
  }

  // 3 segments: category/subgroup/indicator → return indicator content
  const groupPath = `${parts[0]}/${parts[1]}`;
  const indicatorName = parts[2];
  const indicatorContent = getIndicator(groupPath, indicatorName);
  if (!indicatorContent) {
    return `Error: Indicator not found: ${pathArg}`;
  }

  return indicatorContent;
}

async function readDigitalTwin(env, pathArg, userId) {
  const twinData = await getTwinData(env, userId);

  if (!pathArg || pathArg === "/" || pathArg === ".") {
    return twinData;
  }

  const value = getByPath(twinData, pathArg);
  if (value === undefined) return { error: `Path not found: ${pathArg}` };
  return value;
}

async function writeDigitalTwin(env, pathArg, value, userId) {
  // Access control: check category write permissions
  const parts = normalizePath(pathArg).split(".");
  const category = parts[0];
  const access = METAMODEL.accessControl?.[category];
  if (access && !access.user?.includes("w")) {
    return {
      error: `Write access denied. Category '${category}' is read-only for users.`,
    };
  }

  const twinData = await getTwinData(env, userId);
  setByPath(twinData, pathArg, value);
  const saved = await saveTwinData(env, userId, twinData);
  return {
    success: true,
    path: pathArg,
    value,
    user: userId || "anonymous",
    persisted: saved,
  };
}

// ============ MCP Protocol ============

const tools = [
  {
    name: "describe_by_path",
    description:
      "Describe the digital twin metamodel structure. Returns field names, types, and descriptions for a given path. Use empty path or '/' to list all categories.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Path in metamodel. Examples: '/' (root), '1_declarative', '1_declarative/1_2_goals', '1_declarative/1_2_goals/09_Цели обучения'",
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
        path: {
          type: "string",
          description: "Path to data (e.g., '1_declarative/1_2_goals/09_Цели обучения', '1_declarative/1_3_selfeval')",
        },
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
        path: {
          type: "string",
          description: "Path to data (e.g., '1_declarative/1_2_goals/09_Цели обучения', '1_declarative/1_4_context/01_Текущие проблемы')",
        },
        data: {
          description: "Data to write (any JSON value)",
        },
      },
      required: ["path", "data"],
    },
  },
];

async function callTool(env, name, args, userId) {
  switch (name) {
    case "describe_by_path":
      return describeByPath(args.path);
    case "read_digital_twin":
      return await readDigitalTwin(env, args.path, userId);
    case "write_digital_twin":
      return await writeDigitalTwin(env, args.path, args.data, userId);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function handleMCP(env, message, userId) {
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
      const result = await callTool(env, name, args || {}, userId);

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
    const baseUrl = getBaseUrl(env, request);

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

    // Helper to add CORS headers to any response
    function withCors(response) {
      const newHeaders = new Headers(response.headers);
      for (const [k, v] of Object.entries(cors)) {
        newHeaders.set(k, v);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    // ======= OAuth2 Authorization Server Metadata (RFC 8414) =======
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      return withCors(jsonResponse(handleASMetadata(baseUrl)));
    }

    // ======= OAuth2 Protected Resource Metadata (RFC 9728) =======
    if (url.pathname === "/.well-known/oauth-protected-resource") {
      return withCors(jsonResponse({
        resource: baseUrl,
        authorization_servers: [baseUrl],
        scopes_supported: ["openid", "offline_access"],
        bearer_methods_supported: ["header"],
        resource_documentation: `${baseUrl}/docs`,
      }));
    }

    // ======= Dynamic Client Registration (RFC 7591) =======
    if (url.pathname === "/register" && request.method === "POST") {
      return withCors(await handleRegister(request, env));
    }

    // ======= Authorization Endpoint =======
    if (url.pathname === "/authorize" && request.method === "GET") {
      return await handleAuthorize(request, env, baseUrl);
    }

    // ======= Ory Callback =======
    if (url.pathname === "/callback" && request.method === "GET") {
      return await handleCallback(request, env, baseUrl);
    }

    // ======= Token Endpoint =======
    if (url.pathname === "/token" && request.method === "POST") {
      return withCors(await handleToken(request, env));
    }

    // ======= Health check =======
    if (url.pathname === "/health") {
      return withCors(jsonResponse({
        status: "ok",
        auth: "oauth2-as",
      }));
    }

    // ======= MCP endpoint =======
    if (url.pathname === "/mcp" || url.pathname === "/") {
      if (request.method !== "POST") {
        return withCors(jsonResponse({
          name: "digital-twin-mcp",
          version: "2.0.0",
          description: "Digital Twin MCP Server with OAuth2 Authorization Server",
          auth: {
            type: "oauth2",
            metadata_url: `${baseUrl}/.well-known/oauth-authorization-server`,
          },
          storage: env?.DATABASE_URL ? "persistent" : "ephemeral",
          tools: tools.map(t => ({ name: t.name, description: t.description })),
        }));
      }

      // POST - requires authentication
      const authResult = await authenticate(request, env);

      if (!authResult.valid) {
        return withCors(new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32001,
            message: "Unauthorized",
            data: { reason: authResult.error },
          },
        }, null, 2), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": buildWwwAuthenticate(baseUrl, authResult.error),
          },
        }));
      }

      const message = await request.json();
      const response = await handleMCP(env, message, authResult.userId);

      return withCors(jsonResponse(response));
    }

    return withCors(jsonResponse({
      error: "Not found",
      endpoints: [
        "/mcp",
        "/.well-known/oauth-authorization-server",
        "/.well-known/oauth-protected-resource",
        "/register",
        "/authorize",
        "/callback",
        "/token",
        "/health",
      ],
    }, 404));
  },
};
