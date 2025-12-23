// Cloudflare Workers entry point for Digital Twin MCP Server
// Simplified version with single tool: dt.get_time_invested_summary

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'digital-twin-mcp-server',
        version: '1.0.0',
        description: 'Simplified MCP server with single tool',
        endpoints: {
          health: '/',
          tools: '/tools',
          call: '/call (POST)',
        },
      }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // List available tools
    if (url.pathname === '/tools') {
      return new Response(JSON.stringify({
        tools: [
          {
            name: "dt.get_time_invested_summary",
            description: "Получить сводку по инвестированному времени ученика за период",
          }
        ],
        totalTools: 1,
      }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call a tool
    if (url.pathname === '/call' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { tool, arguments: args } = body;

        if (tool !== "dt.get_time_invested_summary") {
          return new Response(JSON.stringify({
            error: `Unknown tool: ${tool}`,
            availableTools: ["dt.get_time_invested_summary"],
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const result = getTimeInvestedSummary(args);

        return new Response(JSON.stringify({
          tool,
          result,
          timestamp: new Date().toISOString(),
        }, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        return new Response(JSON.stringify({
          error: error.message,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 404 for unknown paths
    return new Response(JSON.stringify({
      error: 'Not found',
      availableEndpoints: ['/', '/tools', '/call'],
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
