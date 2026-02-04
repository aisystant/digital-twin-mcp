/**
 * Digital Twin MCP Server - HTTP Transport
 * Tools: describe_by_path, read_digital_twin, write_digital_twin
 * Authentication: Ory.sh
 */

// ============================================
// Ory.sh Authentication
// ============================================

/**
 * Verify session with Ory Kratos
 * @param {Request} request - Incoming request
 * @param {Object} env - Environment variables
 * @returns {Promise<{valid: boolean, session?: Object, error?: string}>}
 */
async function verifyOrySession(request, env) {
  // Check if auth is enabled
  if (!env.ORY_PROJECT_URL) {
    // Auth disabled - allow all requests (dev mode)
    return { valid: true, session: null };
  }

  // Get session token from header or cookie
  const authHeader = request.headers.get("Authorization");
  const cookieHeader = request.headers.get("Cookie");

  let sessionToken = null;

  // Check Bearer token first
  if (authHeader?.startsWith("Bearer ")) {
    sessionToken = authHeader.slice(7);
  }

  // Check ory_session cookie
  if (!sessionToken && cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map(c => {
        const [key, ...val] = c.trim().split("=");
        return [key, val.join("=")];
      })
    );
    sessionToken = cookies["ory_session_token"] || cookies["ory_kratos_session"];
  }

  if (!sessionToken) {
    return { valid: false, error: "No session token provided" };
  }

  try {
    // Verify session with Ory
    const response = await fetch(`${env.ORY_PROJECT_URL}/sessions/whoami`, {
      headers: {
        "Authorization": `Bearer ${sessionToken}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Session expired or invalid" };
      }
      return { valid: false, error: `Ory API error: ${response.status}` };
    }

    const session = await response.json();

    // Check if session is active
    if (!session.active) {
      return { valid: false, error: "Session is not active" };
    }

    return { valid: true, session };
  } catch (err) {
    return { valid: false, error: `Auth verification failed: ${err.message}` };
  }
}

/**
 * Verify API key (alternative auth method)
 * @param {Request} request - Incoming request
 * @param {Object} env - Environment variables
 * @returns {{valid: boolean, error?: string}}
 */
function verifyApiKey(request, env) {
  if (!env.API_KEY) {
    return { valid: true }; // API key auth disabled
  }

  const apiKey = request.headers.get("X-API-Key");

  if (!apiKey) {
    return { valid: false, error: "No API key provided" };
  }

  if (apiKey !== env.API_KEY) {
    return { valid: false, error: "Invalid API key" };
  }

  return { valid: true };
}

/**
 * Main authentication middleware
 * Supports: Ory session, API key, or both
 */
async function authenticate(request, env) {
  // If no auth configured, allow all
  if (!env.ORY_PROJECT_URL && !env.API_KEY) {
    return { valid: true, method: "none" };
  }

  // Try API key first (faster, no network call)
  if (env.API_KEY) {
    const apiKeyResult = verifyApiKey(request, env);
    if (apiKeyResult.valid) {
      return { valid: true, method: "api_key" };
    }
  }

  // Try Ory session
  if (env.ORY_PROJECT_URL) {
    const sessionResult = await verifyOrySession(request, env);
    if (sessionResult.valid) {
      return { valid: true, method: "ory_session", session: sessionResult.session };
    }
    return sessionResult;
  }

  return { valid: false, error: "Authentication required" };
}

// ============================================
// Metamodel & Data
// ============================================

// Metamodel definition (inline)
const METAMODEL = {
  i: {
    _meta: { description: "Root of digital twin data" },
    agency: {
      _meta: { description: "Learner's agency and self-organization" },
      role_set: { type: "set", description: "Current set of learner roles" },
      goals: { type: "list", description: "Learning goals with priorities" },
      daily_task_time: { type: "list", description: "Daily time allocation for tasks" },
    },
    data: {
      _meta: { description: "Objective measurements and metrics" },
      time_invested: { type: "object", description: "Time investment summary" },
      progress: { type: "object", description: "Learning progress by topic" },
    },
    info: {
      _meta: { description: "Static learner information" },
      profile: { type: "object", description: "Basic learner profile" },
      preferences: { type: "object", description: "Learning preferences" },
    },
  },
};

// Twin data (in-memory, resets on restart)
let twinData = {
  i: {
    agency: {
      role_set: ["developer", "learner"],
      goals: [{ goal: "Master MCP protocol", priority: 1 }],
      daily_task_time: [{ task: "coding", minutes: 60 }],
    },
    data: {
      time_invested: { total_hours: 12.5, sessions_count: 18 },
      progress: { mcp: 0.3 },
    },
    info: {
      profile: { name: "Learner", level: "beginner" },
      preferences: { style: "hands-on", pace: "moderate" },
    },
  },
};

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

// Tool: describe_by_path
function describeByPath(pathArg) {
  const normalized = normalizePath(pathArg);
  const node = getByPath(METAMODEL, normalized);

  if (!node) return `Error: Path not found: ${pathArg}`;

  const results = [];
  for (const [key, val] of Object.entries(node)) {
    if (key === "_meta") continue;
    if (val._meta) {
      results.push(`${key}:section:${val._meta.description}`);
    } else if (val.type) {
      results.push(`${key}:${val.type}:${val.description}`);
    }
  }
  return results.join("\n");
}

// Tool: read_digital_twin
function readDigitalTwin(pathArg) {
  const value = getByPath(twinData, pathArg);
  if (value === undefined) return { error: `Path not found: ${pathArg}` };
  return value;
}

// Tool: write_digital_twin
function writeDigitalTwin(pathArg, value) {
  setByPath(twinData, pathArg, value);
  return { success: true, path: pathArg, value };
}

// MCP Tools schema
const tools = [
  {
    name: "describe_by_path",
    description: "Describe the digital twin metamodel structure",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path (e.g., 'i', 'i.agency', 'i/data')" },
      },
      required: ["path"],
    },
  },
  {
    name: "read_digital_twin",
    description: "Read data from the digital twin",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path (e.g., 'i.agency.role_set')" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_digital_twin",
    description: "Write data to the digital twin",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path (e.g., 'i.agency.role_set')" },
        data: { description: "Data to write (any JSON value)" },
      },
      required: ["path", "data"],
    },
  },
];

// Handle MCP JSON-RPC
function handleMCP(message) {
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
          serverInfo: { name: "digital-twin-mcp", version: "1.0.0" },
        },
      };

    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools } };

    case "tools/call": {
      const { name, arguments: args } = params;
      let result;

      if (name === "describe_by_path") {
        result = describeByPath(args.path);
      } else if (name === "read_digital_twin") {
        result = readDigitalTwin(args.path);
      } else if (name === "write_digital_twin") {
        result = writeDigitalTwin(args.path, args.data);
      } else {
        return { jsonrpc: "2.0", id, error: { code: -32601, message: `Tool not found: ${name}` } };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        },
      };
    }

    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      "Access-Control-Allow-Credentials": "true",
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // Health check endpoint (no auth required)
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", auth: !!env.ORY_PROJECT_URL }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Auth info endpoint (no auth required)
    if (url.pathname === "/auth/info") {
      return new Response(JSON.stringify({
        ory_enabled: !!env.ORY_PROJECT_URL,
        api_key_enabled: !!env.API_KEY,
        ory_project_url: env.ORY_PROJECT_URL || null,
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // MCP endpoint
    if (url.pathname === "/mcp" || url.pathname === "/") {
      // GET request - show info (no auth for discovery)
      if (request.method !== "POST") {
        return new Response(JSON.stringify({
          info: "POST JSON-RPC to this endpoint",
          tools: tools.map(t => t.name),
          auth_required: !!(env.ORY_PROJECT_URL || env.API_KEY),
        }, null, 2), {
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
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const message = await request.json();

      // Add auth context to request (available in tool handlers if needed)
      const response = handleMCP(message, {
        authMethod: authResult.method,
        session: authResult.session,
        userId: authResult.session?.identity?.id,
      });

      return new Response(JSON.stringify(response, null, 2), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found", endpoints: ["/mcp", "/health", "/auth/info"] }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
