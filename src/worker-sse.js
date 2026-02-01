/**
 * Digital Twin MCP Server - HTTP Transport
 * Tools: describe_by_path, read_digital_twin, write_digital_twin
 */

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
  async fetch(request) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // MCP endpoint
    if (url.pathname === "/mcp" || url.pathname === "/") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ info: "POST JSON-RPC to this endpoint", tools: tools.map(t => t.name) }, null, 2), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const message = await request.json();
      const response = handleMCP(message);
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
