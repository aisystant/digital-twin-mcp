/**
 * Digital Twin MCP Server - SSE/HTTP Transport
 * Simplified version with single tool: dt.get_time_invested_summary
 */

// Mock data for time invested
const mockTimeData = {
  total_hours: 12.5,
  sessions_count: 18,
  pomodoros_completed: 45,
  days_with_activity: 15,
  avg_daily_minutes: 26,
};

// Single tool implementation
function getTimeInvestedSummary(args) {
  const period_start = args?.period_start || "2025-11-20";
  const period_end = args?.period_end || "2025-12-20";

  return {
    ...mockTimeData,
    period: {
      start: period_start,
      end: period_end,
    },
  };
}

// MCP Tool schema
const tools = [
  {
    name: "dt.get_time_invested_summary",
    description: "Получить сводку по инвестированному времени ученика за период. Returns total hours, sessions count, pomodoros completed, days with activity, and average daily minutes.",
    inputSchema: {
      type: "object",
      properties: {
        period_start: {
          type: "string",
          description: "Start date (ISO format YYYY-MM-DD, optional)",
        },
        period_end: {
          type: "string",
          description: "End date (ISO format YYYY-MM-DD, optional)",
        },
      },
      required: [],
    },
  },
];

// Handle MCP protocol messages
function handleMCPMessage(message) {
  const { jsonrpc, id, method, params } = message;

  if (jsonrpc !== "2.0") {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32600, message: "Invalid Request - jsonrpc must be '2.0'" },
    };
  }

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "digital-twin-mcp-server",
              version: "1.0.0",
            },
          },
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: tools,
          },
        };

      case "tools/call":
        const { name, arguments: args } = params;

        if (name !== "dt.get_time_invested_summary") {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Tool not found: ${name}` },
          };
        }

        const result = getTimeInvestedSummary(args);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        };

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: error.message,
      },
    };
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // MCP endpoint - handles JSON-RPC messages
    if (url.pathname === '/mcp' || url.pathname === '/') {
      if (request.method !== 'POST') {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32600, message: "Use POST to send MCP messages" },
            serverInfo: {
              name: "digital-twin-mcp-server",
              version: "1.0.0",
              tool: "dt.get_time_invested_summary",
            },
          }, null, 2),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      try {
        const message = await request.json();
        const response = handleMCPMessage(message);

        return new Response(JSON.stringify(response, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse error" },
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Documentation endpoint
    if (url.pathname === '/docs') {
      return new Response(
        JSON.stringify({
          name: "Digital Twin MCP Server",
          version: "1.0.0",
          protocol: "MCP 2024-11-05",
          endpoint: url.origin + "/mcp",
          tools: tools,
          example: {
            listTools: {
              jsonrpc: "2.0",
              id: 1,
              method: "tools/list",
              params: {}
            },
            callTool: {
              jsonrpc: "2.0",
              id: 2,
              method: "tools/call",
              params: {
                name: "dt.get_time_invested_summary",
                arguments: {}
              }
            }
          }
        }, null, 2),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 404 for unknown paths
    return new Response(
      JSON.stringify({
        error: "Not found",
        availableEndpoints: ["/mcp", "/docs"],
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  },
};
