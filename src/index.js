import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Mock data for time invested
const mockTimeData = {
  total_hours: 12.5,
  sessions_count: 18,
  pomodoros_completed: 45,
  days_with_activity: 15,
  avg_daily_minutes: 26,
};

// Create MCP server
const server = new Server(
  {
    name: "digital-twin-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define single tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
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
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name !== "dt.get_time_invested_summary") {
    return {
      content: [{ type: "text", text: `Error: Unknown tool: ${name}` }],
      isError: true,
    };
  }

  const period_start = args?.period_start || "2025-11-20";
  const period_end = args?.period_end || "2025-12-20";

  const result = {
    ...mockTimeData,
    period: {
      start: period_start,
      end: period_end,
    },
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Digital Twin MCP Server running on stdio");
  console.error("Available tool: dt.get_time_invested_summary");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
