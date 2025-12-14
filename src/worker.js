// Cloudflare Workers entry point for Digital Twin MCP Server
// This handles HTTP requests and translates them to MCP protocol

// Mock data store
const mockData = {
  learners: new Map(),
  routes: new Map(),
  sessions: new Map(),
  stageHistory: new Map(),
  aggregates: new Map(),
};

// Initialize with sample data
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
      {
        id: "step_001",
        title: "Morning 15-min slot",
        status: "completed",
        priority: 1,
      },
      {
        id: "step_002",
        title: "Evening reflection 10 min",
        status: "in_progress",
        priority: 2,
      },
      {
        id: "step_003",
        title: "Weekend deep work 2 hours",
        status: "pending",
        priority: 3,
      },
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

// Tool implementations
const tools = {
  get_learner_summary: (args) => {
    const learner = mockData.learners.get(args.learner_id);
    if (!learner) {
      throw new Error(`Learner ${args.learner_id} not found`);
    }
    return {
      learnerId: args.learner_id,
      period: { start: args.period_start, end: args.period_end },
      summary: learner,
    };
  },

  get_learner_core_metrics: (args) => {
    const metrics = mockData.aggregates.get(args.learner_id);
    if (!metrics) {
      throw new Error(`Metrics for learner ${args.learner_id} not found`);
    }
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
    if (metrics) {
      metrics.metrics["2.4.2"].value = args.stage;
    }

    return {
      id: `stage_eval_${Date.now()}`,
      learnerId: args.learner_id,
      stage: args.stage,
      createdAt: newEntry.date,
    };
  },

  get_learning_route: (args) => {
    const route = mockData.routes.get(args.learner_id);
    if (!route) {
      throw new Error(`Route for learner ${args.learner_id} not found`);
    }
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
    return {
      id: route.id,
      learnerId: args.learner_id,
      version: route.updatedAt,
    };
  },

  update_route_step_status: (args) => {
    const route = mockData.routes.get(args.learner_id);
    if (!route) {
      throw new Error(`Route for learner ${args.learner_id} not found`);
    }
    const step = route.steps.find(s => s.id === args.step_id);
    if (!step) {
      throw new Error(`Step ${args.step_id} not found`);
    }
    step.status = args.new_status;
    if (args.comment) {
      step.comment = args.comment;
    }
    step.updatedAt = new Date().toISOString();
    route.updatedAt = new Date().toISOString();
    mockData.routes.set(args.learner_id, route);
    return {
      stepId: args.step_id,
      status: args.new_status,
      updatedAt: step.updatedAt,
    };
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
    return {
      id: session.id,
      learnerId: args.learner_id,
      createdAt: session.date,
    };
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
    return {
      learnerId: args.learner_id,
      period: args.period,
      trends,
    };
  },

  read_entities: (args) => {
    return {
      entityType: args.entity_type,
      filters: args.filters,
      count: 0,
      entities: [],
    };
  },

  upsert_entity: (args) => {
    return {
      entityType: args.entity_type,
      id: args.entity_id || `${args.entity_type}_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
  },
};

// Tool definitions for API documentation
const toolDefinitions = [
  {
    name: "get_learner_summary",
    description: "Get summary for a learner for a specified period",
    group: "A - Diagnostics",
  },
  {
    name: "get_learner_core_metrics",
    description: "Get core derived metrics (2.*) for learner stage analysis",
    group: "A - Diagnostics",
  },
  {
    name: "get_stage_history",
    description: "Get history of learner stage changes",
    group: "A - Diagnostics",
  },
  {
    name: "upsert_learner_stage_evaluation",
    description: "Record or update learner stage evaluation",
    group: "A - Diagnostics",
  },
  {
    name: "get_learning_route",
    description: "Get current learning route for a learner",
    group: "B - Routes",
  },
  {
    name: "upsert_learning_route",
    description: "Create or update learning route",
    group: "B - Routes",
  },
  {
    name: "update_route_step_status",
    description: "Update status of a specific route step",
    group: "B - Routes",
  },
  {
    name: "log_guide_session",
    description: "Record a guide session",
    group: "C - Sessions",
  },
  {
    name: "get_recent_guide_sessions",
    description: "Get recent guide sessions for dialog context",
    group: "C - Sessions",
  },
  {
    name: "recalc_aggregates_for_period",
    description: "Recalculate derived metrics for a period",
    group: "D - Aggregates",
  },
  {
    name: "get_aggregate_trends",
    description: "Get time series trends for specified metrics",
    group: "D - Aggregates",
  },
  {
    name: "read_entities",
    description: "Generic tool to read entities by filters",
    group: "E - Universal",
  },
  {
    name: "upsert_entity",
    description: "Generic tool to create or update an entity",
    group: "E - Universal",
  },
];

// Initialize data on worker start
initializeMockData();

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
        endpoints: {
          health: '/',
          tools: '/tools',
          call: '/call (POST)',
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // List available tools
    if (url.pathname === '/tools') {
      const groupedTools = {};
      toolDefinitions.forEach(tool => {
        if (!groupedTools[tool.group]) {
          groupedTools[tool.group] = [];
        }
        groupedTools[tool.group].push({
          name: tool.name,
          description: tool.description,
        });
      });

      return new Response(JSON.stringify({
        tools: toolDefinitions,
        groupedTools,
        totalTools: toolDefinitions.length,
      }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call a tool
    if (url.pathname === '/call' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { tool, arguments: args } = body;

        if (!tool) {
          return new Response(JSON.stringify({
            error: 'Missing tool name',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const toolFn = tools[tool];
        if (!toolFn) {
          return new Response(JSON.stringify({
            error: `Unknown tool: ${tool}`,
            availableTools: Object.keys(tools),
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const result = toolFn(args || {});

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
          stack: error.stack,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 404 for unknown paths
    return new Response(JSON.stringify({
      error: 'Not found',
      path: url.pathname,
      availableEndpoints: ['/', '/tools', '/call'],
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
