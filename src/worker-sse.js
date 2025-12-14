/**
 * Digital Twin MCP Server - SSE/HTTP Transport
 *
 * This implements the Model Context Protocol over HTTP with SSE streaming
 * Compatible with Claude and other MCP clients
 */

// Mock data store
const mockData = {
  learners: new Map(),
  routes: new Map(),
  sessions: new Map(),
  stageHistory: new Map(),
  aggregates: new Map(),
};

// Initialize mock data
function initializeMockData() {
  const learnerId = "learner_001";

  mockData.learners.set(learnerId, {
    id: learnerId,
    name: "Sample Learner",
    totalHours: 45.5,
    sessions: 23,
    pomodoros: 67,
    completedTasks: 15,
    clubActivity: 8,
  });

  mockData.aggregates.set(learnerId, {
    learnerId,
    period: "4_weeks",
    metrics: {
      "2.1.1": { value: 45.5, label: "Total hours", trend: "up" },
      "2.1.2": { value: 4.2, label: "Sessions per week", trend: "stable" },
      "2.2.1": { value: 0.75, label: "Practice regularity", trend: "up" },
      "2.4.2": { value: "Практикующий", label: "Current stage" },
      "2.10.1": { value: "motivation_gaps", label: "Stuck profile" },
    },
  });

  mockData.stageHistory.set(learnerId, [
    {
      date: "2024-11-01",
      stage: "Случайный",
      comment: "Initial assessment",
      metrics: { hours: 5, regularity: 0.2 },
    },
    {
      date: "2024-11-15",
      stage: "Практикующий",
      comment: "Established 15+ min daily practice",
      metrics: { hours: 12, regularity: 0.6 },
    },
  ]);

  mockData.routes.set(learnerId, {
    id: "route_001",
    learnerId,
    goals: "Establish systematic daily practice of 30+ minutes",
    steps: [
      { id: "step_001", title: "Morning 15-min slot", status: "completed", priority: 1 },
      { id: "step_002", title: "Evening reflection 10 min", status: "in_progress", priority: 2 },
      { id: "step_003", title: "Weekend deep work 2 hours", status: "pending", priority: 3 },
    ],
    createdAt: "2024-11-20",
    updatedAt: "2024-12-01",
  });

  mockData.sessions.set(learnerId, [
    {
      id: "session_001",
      learnerId,
      type: "weekly",
      date: "2024-12-01",
      summary: "Progress review, adjusted evening slot timing",
      actions: ["Updated route step 002", "Discussed motivation gaps"],
    },
  ]);
}

initializeMockData();

// Tool implementations
const toolHandlers = {
  get_learner_summary: (args) => {
    const learner = mockData.learners.get(args.learner_id);
    if (!learner) throw new Error(`Learner ${args.learner_id} not found`);
    return {
      learnerId: args.learner_id,
      period: { start: args.period_start, end: args.period_end },
      summary: learner,
    };
  },

  get_learner_core_metrics: (args) => {
    const metrics = mockData.aggregates.get(args.learner_id);
    if (!metrics) throw new Error(`Metrics for learner ${args.learner_id} not found`);
    return {
      learnerId: args.learner_id,
      period: args.period || "4_weeks",
      metrics: metrics.metrics,
      calculatedAt: new Date().toISOString(),
    };
  },

  get_stage_history: (args) => {
    const history = mockData.stageHistory.get(args.learner_id) || [];
    return {
      learnerId: args.learner_id,
      history: history.slice(0, args.limit || 10),
    };
  },

  upsert_learner_stage_evaluation: (args) => {
    const history = mockData.stageHistory.get(args.learner_id) || [];
    const newEntry = {
      date: new Date().toISOString().split('T')[0],
      stage: args.stage,
      comment: args.reason,
      metrics: args.metrics_snapshot || {},
    };
    history.push(newEntry);
    mockData.stageHistory.set(args.learner_id, history);

    const metrics = mockData.aggregates.get(args.learner_id);
    if (metrics) metrics.metrics["2.4.2"].value = args.stage;

    return {
      id: `stage_eval_${Date.now()}`,
      learnerId: args.learner_id,
      stage: args.stage,
      createdAt: newEntry.date,
    };
  },

  get_learning_route: (args) => {
    const route = mockData.routes.get(args.learner_id);
    if (!route) throw new Error(`Route for learner ${args.learner_id} not found`);
    return route;
  },

  upsert_learning_route: (args) => {
    const existingRoute = mockData.routes.get(args.learner_id);
    const route = {
      id: existingRoute?.id || `route_${Date.now()}`,
      learnerId: args.learner_id,
      goals: args.route_data.goals,
      steps: args.route_data.steps,
      createdAt: existingRoute?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockData.routes.set(args.learner_id, route);
    return { id: route.id, learnerId: args.learner_id, version: route.updatedAt };
  },

  update_route_step_status: (args) => {
    const route = mockData.routes.get(args.learner_id);
    if (!route) throw new Error(`Route for learner ${args.learner_id} not found`);
    const step = route.steps.find(s => s.id === args.step_id);
    if (!step) throw new Error(`Step ${args.step_id} not found`);

    step.status = args.new_status;
    if (args.comment) step.comment = args.comment;
    step.updatedAt = new Date().toISOString();
    route.updatedAt = new Date().toISOString();
    mockData.routes.set(args.learner_id, route);

    return { stepId: args.step_id, status: args.new_status, updatedAt: step.updatedAt };
  },

  log_guide_session: (args) => {
    const sessions = mockData.sessions.get(args.learner_id) || [];
    const session = {
      id: `session_${Date.now()}`,
      learnerId: args.learner_id,
      type: args.session_type,
      date: new Date().toISOString(),
      summary: args.input_summary,
      actions: args.actions,
      dataRefs: args.used_data_refs || [],
    };
    sessions.push(session);
    mockData.sessions.set(args.learner_id, sessions);
    return { id: session.id, learnerId: args.learner_id, createdAt: session.date };
  },

  get_recent_guide_sessions: (args) => {
    const sessions = mockData.sessions.get(args.learner_id) || [];
    return {
      learnerId: args.learner_id,
      sessions: sessions.slice(-(args.limit || 5)).reverse(),
    };
  },

  recalc_aggregates_for_period: (args) => {
    return {
      learnerId: args.learner_id,
      period: args.period,
      status: "recalculated",
      timestamp: new Date().toISOString(),
    };
  },

  get_aggregate_trends: (args) => {
    const trends = {};
    (args.metric_keys || []).forEach(key => {
      trends[key] = {
        metric: key,
        period: args.period,
        dataPoints: [
          { date: "2024-11-01", value: 10 },
          { date: "2024-11-08", value: 15 },
          { date: "2024-11-15", value: 18 },
          { date: "2024-11-22", value: 20 },
          { date: "2024-11-29", value: 22 },
        ],
      };
    });
    return { learnerId: args.learner_id, period: args.period, trends };
  },

  read_entities: (args) => {
    return { entityType: args.entity_type, filters: args.filters, count: 0, entities: [] };
  },

  upsert_entity: (args) => {
    return {
      entityType: args.entity_type,
      id: args.entity_id || `${args.entity_type}_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
  },
};

// MCP Tools schema
const tools = [
  {
    name: "get_learner_summary",
    description: "Get summary for a learner for a specified period. Returns total hours, sessions, pomodoros, completed tasks, and club activity.",
    inputSchema: {
      type: "object",
      properties: {
        learner_id: { type: "string", description: "Learner identifier" },
        period_start: { type: "string", description: "Period start date (ISO format, optional)" },
        period_end: { type: "string", description: "Period end date (ISO format, optional)" },
      },
      required: ["learner_id"],
    },
  },
  {
    name: "get_learner_core_metrics",
    description: "Get core derived metrics (2.*) for learner stage analysis. Returns hours, regularity, practice level, mastery, current stage, and stuck profile.",
    inputSchema: {
      type: "object",
      properties: {
        learner_id: { type: "string", description: "Learner identifier" },
        period: { type: "string", enum: ["4_weeks", "8_weeks", "3_months"], description: "Analysis period" },
      },
      required: ["learner_id"],
    },
  },
  {
    name: "get_stage_history",
    description: "Get history of learner stage changes with dates, stages, comments, and key metrics.",
    inputSchema: {
      type: "object",
      properties: {
        learner_id: { type: "string", description: "Learner identifier" },
        limit: { type: "number", description: "Maximum number of records to return" },
      },
      required: ["learner_id"],
    },
  },
  {
    name: "upsert_learner_stage_evaluation",
    description: "Record or update learner stage evaluation. Creates a new entry in stage history.",
    inputSchema: {
      type: "object",
      properties: {
        learner_id: { type: "string", description: "Learner identifier" },
        stage: {
          type: "string",
          enum: ["Случайный", "Практикующий", "Систематический", "Дисциплинированный", "Проактивный"],
          description: "Learner stage",
        },
        reason: { type: "string", description: "Reason for this stage assessment" },
        metrics_snapshot: { type: "object", description: "Snapshot of key metrics at this evaluation" },
      },
      required: ["learner_id", "stage", "reason"],
    },
  },
  {
    name: "get_learning_route",
    description: "Get current learning route for a learner with goals, steps, and their statuses.",
    inputSchema: {
      type: "object",
      properties: {
        learner_id: { type: "string", description: "Learner identifier" },
      },
      required: ["learner_id"],
    },
  },
  {
    name: "upsert_learning_route",
    description: "Create or update learning route with goals and steps.",
    inputSchema: {
      type: "object",
      properties: {
        learner_id: { type: "string", description: "Learner identifier" },
        route_data: {
          type: "object",
          properties: {
            goals: { type: "string", description: "Route goals description" },
            steps: {
              type: "array",
              description: "Array of route steps",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                  priority: { type: "number" },
                },
              },
            },
          },
          required: ["goals", "steps"],
        },
      },
      required: ["learner_id", "route_data"],
    },
  },
  {
    name: "update_route_step_status",
    description: "Update status of a specific route step.",
    inputSchema: {
      type: "object",
      properties: {
        learner_id: { type: "string", description: "Learner identifier" },
        step_id: { type: "string", description: "Step identifier" },
        new_status: {
          type: "string",
          enum: ["pending", "in_progress", "completed"],
          description: "New step status",
        },
        comment: { type: "string", description: "Optional comment about the status change" },
      },
      required: ["learner_id", "step_id", "new_status"],
    },
  },
  {
    name: "log_guide_session",
    description: "Record a guide session with type, summary, actions taken, and data references used.",
    inputSchema: {
      type: "object",
      properties: {
        learner_id: { type: "string", description: "Learner identifier" },
        session_type: {
          type: "string",
          enum: ["one_time", "weekly", "transition", "reactivation"],
          description: "Type of guide session",
        },
        input_summary: { type: "string", description: "Summary of the session input/discussion" },
        actions: { type: "array", items: { type: "string" }, description: "Actions taken during session" },
        used_data_refs: {
          type: "array",
          items: { type: "string" },
          description: "References to data used in decision making",
        },
      },
      required: ["learner_id", "session_type", "input_summary", "actions"],
    },
  },
  {
    name: "get_recent_guide_sessions",
    description: "Get recent guide sessions for dialog context.",
    inputSchema: {
      type: "object",
      properties: {
        learner_id: { type: "string", description: "Learner identifier" },
        limit: { type: "number", description: "Maximum number of sessions to return" },
      },
      required: ["learner_id"],
    },
  },
  {
    name: "recalc_aggregates_for_period",
    description: "Recalculate derived metrics (2.*) for a specified period.",
    inputSchema: {
      type: "object",
      properties: {
        learner_id: { type: "string", description: "Learner identifier" },
        period: { type: "string", description: "Period to recalculate (e.g., '1_week', '4_weeks')" },
      },
      required: ["learner_id", "period"],
    },
  },
  {
    name: "get_aggregate_trends",
    description: "Get time series trends for specified metrics.",
    inputSchema: {
      type: "object",
      properties: {
        learner_id: { type: "string", description: "Learner identifier" },
        metric_keys: {
          type: "array",
          items: { type: "string" },
          description: "List of metric keys to get trends for (e.g., ['2.1.1', '2.2.1'])",
        },
        period: { type: "string", description: "Period for trend analysis" },
      },
      required: ["learner_id", "metric_keys", "period"],
    },
  },
  {
    name: "read_entities",
    description: "Generic tool to read entities by filters.",
    inputSchema: {
      type: "object",
      properties: {
        entity_type: { type: "string", description: "Type of entity to read" },
        filters: { type: "object", description: "Filter criteria as key-value pairs" },
        limit: { type: "number", description: "Maximum number of entities to return" },
      },
      required: ["entity_type"],
    },
  },
  {
    name: "upsert_entity",
    description: "Generic tool to create or update an entity.",
    inputSchema: {
      type: "object",
      properties: {
        entity_type: { type: "string", description: "Type of entity" },
        entity_id: { type: "string", description: "Entity identifier (optional for creation)" },
        data: { type: "object", description: "Entity data as JSON" },
      },
      required: ["entity_type", "data"],
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
        const handler = toolHandlers[name];

        if (!handler) {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Tool not found: ${name}` },
          };
        }

        const result = handler(args || {});
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
        data: { stack: error.stack },
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
      'Access-Control-Max-Age': '86400',
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
              description: "MCP server for Digital Twin learner data",
              protocol: "MCP 2024-11-05",
              endpoints: {
                mcp: "POST /mcp - Send JSON-RPC 2.0 messages",
                docs: "GET /docs - API documentation",
              }
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
            error: {
              code: -32700,
              message: "Parse error",
              data: { error: error.message },
            },
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
          protocol: "MCP (Model Context Protocol) 2024-11-05",
          transport: "HTTP with JSON-RPC 2.0",
          endpoint: url.origin + "/mcp",
          connection: {
            instructions: "Send POST requests to /mcp endpoint with JSON-RPC 2.0 format",
            example: {
              method: "POST",
              url: url.origin + "/mcp",
              headers: { "Content-Type": "application/json" },
              body: {
                jsonrpc: "2.0",
                id: 1,
                method: "tools/list",
                params: {}
              }
            }
          },
          tools: tools.map(t => ({ name: t.name, description: t.description })),
          exampleUsage: {
            initialize: {
              jsonrpc: "2.0",
              id: 1,
              method: "initialize",
              params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "claude", version: "1.0.0" }
              }
            },
            listTools: {
              jsonrpc: "2.0",
              id: 2,
              method: "tools/list",
              params: {}
            },
            callTool: {
              jsonrpc: "2.0",
              id: 3,
              method: "tools/call",
              params: {
                name: "get_learner_summary",
                arguments: { learner_id: "learner_001" }
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
        availableEndpoints: {
          "/mcp": "MCP protocol endpoint (POST JSON-RPC messages)",
          "/docs": "API documentation",
        },
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  },
};
