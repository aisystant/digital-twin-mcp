import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Mock data store (in production, this would be SurrealDB or similar)
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

  // Sample learner summary
  mockData.learners.set(learnerId, {
    id: learnerId,
    name: "Sample Learner",
    totalHours: 45.5,
    sessions: 23,
    pomodoros: 67,
    completedTasks: 15,
    clubActivity: 8,
  });

  // Sample core metrics
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

  // Sample stage history
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

  // Sample learning route
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

  // Sample guide sessions
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

// Initialize mock data
initializeMockData();

// Helper functions
function getLearnerSummary(learnerId, periodStart, periodEnd) {
  const learner = mockData.learners.get(learnerId);
  if (!learner) {
    throw new Error(`Learner ${learnerId} not found`);
  }

  return {
    learnerId,
    period: { start: periodStart, end: periodEnd },
    summary: learner,
  };
}

function getLearnerCoreMetrics(learnerId, period = "4_weeks") {
  const metrics = mockData.aggregates.get(learnerId);
  if (!metrics) {
    throw new Error(`Metrics for learner ${learnerId} not found`);
  }

  return {
    learnerId,
    period,
    metrics: metrics.metrics,
    calculatedAt: new Date().toISOString(),
  };
}

function getStageHistory(learnerId, limit = 10) {
  const history = mockData.stageHistory.get(learnerId) || [];
  return {
    learnerId,
    history: history.slice(0, limit),
  };
}

function upsertLearnerStageEvaluation(learnerId, stage, reason, metricsSnapshot) {
  const history = mockData.stageHistory.get(learnerId) || [];

  const newEntry = {
    date: new Date().toISOString().split('T')[0],
    stage,
    comment: reason,
    metrics: metricsSnapshot,
  };

  history.push(newEntry);
  mockData.stageHistory.set(learnerId, history);

  // Update current stage in aggregates
  const metrics = mockData.aggregates.get(learnerId);
  if (metrics) {
    metrics.metrics["2.4.2"].value = stage;
  }

  return {
    id: `stage_eval_${Date.now()}`,
    learnerId,
    stage,
    createdAt: newEntry.date,
  };
}

function getLearningRoute(learnerId) {
  const route = mockData.routes.get(learnerId);
  if (!route) {
    throw new Error(`Route for learner ${learnerId} not found`);
  }

  return route;
}

function upsertLearningRoute(learnerId, routeData) {
  const existingRoute = mockData.routes.get(learnerId);

  const route = {
    id: existingRoute?.id || `route_${Date.now()}`,
    learnerId,
    goals: routeData.goals,
    steps: routeData.steps,
    createdAt: existingRoute?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockData.routes.set(learnerId, route);

  return {
    id: route.id,
    learnerId,
    version: route.updatedAt,
  };
}

function updateRouteStepStatus(learnerId, stepId, newStatus, comment) {
  const route = mockData.routes.get(learnerId);
  if (!route) {
    throw new Error(`Route for learner ${learnerId} not found`);
  }

  const step = route.steps.find(s => s.id === stepId);
  if (!step) {
    throw new Error(`Step ${stepId} not found in route`);
  }

  step.status = newStatus;
  if (comment) {
    step.comment = comment;
  }
  step.updatedAt = new Date().toISOString();

  route.updatedAt = new Date().toISOString();
  mockData.routes.set(learnerId, route);

  return {
    stepId,
    status: newStatus,
    updatedAt: step.updatedAt,
  };
}

function logGuideSession(learnerId, sessionType, inputSummary, actions, usedDataRefs) {
  const sessions = mockData.sessions.get(learnerId) || [];

  const session = {
    id: `session_${Date.now()}`,
    learnerId,
    type: sessionType,
    date: new Date().toISOString(),
    summary: inputSummary,
    actions,
    dataRefs: usedDataRefs,
  };

  sessions.push(session);
  mockData.sessions.set(learnerId, sessions);

  return {
    id: session.id,
    learnerId,
    createdAt: session.date,
  };
}

function getRecentGuideSessions(learnerId, limit = 5) {
  const sessions = mockData.sessions.get(learnerId) || [];
  return {
    learnerId,
    sessions: sessions.slice(-limit).reverse(),
  };
}

function recalcAggregatesForPeriod(learnerId, period) {
  // In production, this would recalculate metrics from raw data
  // For mock, we just return confirmation
  return {
    learnerId,
    period,
    status: "recalculated",
    timestamp: new Date().toISOString(),
  };
}

function getAggregateTrends(learnerId, metricKeys, period) {
  // Mock trend data
  const trends = {};

  metricKeys.forEach(key => {
    trends[key] = {
      metric: key,
      period,
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
    learnerId,
    period,
    trends,
  };
}

function readEntities(entityType, filters, limit = 100) {
  // Mock generic entity reader
  return {
    entityType,
    filters,
    count: 0,
    entities: [],
  };
}

function upsertEntity(entityType, entityId, data) {
  // Mock generic entity upsert
  return {
    entityType,
    id: entityId || `${entityType}_${Date.now()}`,
    updatedAt: new Date().toISOString(),
  };
}

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

// Define all tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Group A: Diagnostics and Learner Stages
      {
        name: "get_learner_summary",
        description: "Get summary for a learner for a specified period. Returns total hours, sessions, pomodoros, completed tasks, and club activity.",
        inputSchema: {
          type: "object",
          properties: {
            learner_id: {
              type: "string",
              description: "Learner identifier",
            },
            period_start: {
              type: "string",
              description: "Period start date (ISO format, optional)",
            },
            period_end: {
              type: "string",
              description: "Period end date (ISO format, optional)",
            },
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
            learner_id: {
              type: "string",
              description: "Learner identifier",
            },
            period: {
              type: "string",
              enum: ["4_weeks", "8_weeks", "3_months"],
              description: "Analysis period",
            },
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
            learner_id: {
              type: "string",
              description: "Learner identifier",
            },
            limit: {
              type: "number",
              description: "Maximum number of records to return",
            },
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
            learner_id: {
              type: "string",
              description: "Learner identifier",
            },
            stage: {
              type: "string",
              enum: ["Случайный", "Практикующий", "Систематический", "Дисциплинированный", "Проактивный"],
              description: "Learner stage",
            },
            reason: {
              type: "string",
              description: "Reason for this stage assessment",
            },
            metrics_snapshot: {
              type: "object",
              description: "Snapshot of key metrics at this evaluation",
            },
          },
          required: ["learner_id", "stage", "reason"],
        },
      },

      // Group B: Route and Route Steps
      {
        name: "get_learning_route",
        description: "Get current learning route for a learner with goals, steps, and their statuses.",
        inputSchema: {
          type: "object",
          properties: {
            learner_id: {
              type: "string",
              description: "Learner identifier",
            },
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
            learner_id: {
              type: "string",
              description: "Learner identifier",
            },
            route_data: {
              type: "object",
              properties: {
                goals: {
                  type: "string",
                  description: "Route goals description",
                },
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
            learner_id: {
              type: "string",
              description: "Learner identifier",
            },
            step_id: {
              type: "string",
              description: "Step identifier",
            },
            new_status: {
              type: "string",
              enum: ["pending", "in_progress", "completed"],
              description: "New step status",
            },
            comment: {
              type: "string",
              description: "Optional comment about the status change",
            },
          },
          required: ["learner_id", "step_id", "new_status"],
        },
      },

      // Group C: Guide Sessions and Events
      {
        name: "log_guide_session",
        description: "Record a guide session with type, summary, actions taken, and data references used.",
        inputSchema: {
          type: "object",
          properties: {
            learner_id: {
              type: "string",
              description: "Learner identifier",
            },
            session_type: {
              type: "string",
              enum: ["one_time", "weekly", "transition", "reactivation"],
              description: "Type of guide session",
            },
            input_summary: {
              type: "string",
              description: "Summary of the session input/discussion",
            },
            actions: {
              type: "array",
              items: { type: "string" },
              description: "Actions taken during session",
            },
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
            learner_id: {
              type: "string",
              description: "Learner identifier",
            },
            limit: {
              type: "number",
              description: "Maximum number of sessions to return",
            },
          },
          required: ["learner_id"],
        },
      },

      // Group D: Aggregates and Dynamics
      {
        name: "recalc_aggregates_for_period",
        description: "Recalculate derived metrics (2.*) for a specified period.",
        inputSchema: {
          type: "object",
          properties: {
            learner_id: {
              type: "string",
              description: "Learner identifier",
            },
            period: {
              type: "string",
              description: "Period to recalculate (e.g., '1_week', '4_weeks')",
            },
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
            learner_id: {
              type: "string",
              description: "Learner identifier",
            },
            metric_keys: {
              type: "array",
              items: { type: "string" },
              description: "List of metric keys to get trends for (e.g., ['2.1.1', '2.2.1'])",
            },
            period: {
              type: "string",
              description: "Period for trend analysis",
            },
          },
          required: ["learner_id", "metric_keys", "period"],
        },
      },

      // Group E: Universal Tools
      {
        name: "read_entities",
        description: "Generic tool to read entities by filters.",
        inputSchema: {
          type: "object",
          properties: {
            entity_type: {
              type: "string",
              description: "Type of entity to read",
            },
            filters: {
              type: "object",
              description: "Filter criteria as key-value pairs",
            },
            limit: {
              type: "number",
              description: "Maximum number of entities to return",
            },
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
            entity_type: {
              type: "string",
              description: "Type of entity",
            },
            entity_id: {
              type: "string",
              description: "Entity identifier (optional for creation)",
            },
            data: {
              type: "object",
              description: "Entity data as JSON",
            },
          },
          required: ["entity_type", "data"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      // Group A
      case "get_learner_summary":
        result = getLearnerSummary(
          args.learner_id,
          args.period_start,
          args.period_end
        );
        break;

      case "get_learner_core_metrics":
        result = getLearnerCoreMetrics(args.learner_id, args.period);
        break;

      case "get_stage_history":
        result = getStageHistory(args.learner_id, args.limit);
        break;

      case "upsert_learner_stage_evaluation":
        result = upsertLearnerStageEvaluation(
          args.learner_id,
          args.stage,
          args.reason,
          args.metrics_snapshot
        );
        break;

      // Group B
      case "get_learning_route":
        result = getLearningRoute(args.learner_id);
        break;

      case "upsert_learning_route":
        result = upsertLearningRoute(args.learner_id, args.route_data);
        break;

      case "update_route_step_status":
        result = updateRouteStepStatus(
          args.learner_id,
          args.step_id,
          args.new_status,
          args.comment
        );
        break;

      // Group C
      case "log_guide_session":
        result = logGuideSession(
          args.learner_id,
          args.session_type,
          args.input_summary,
          args.actions,
          args.used_data_refs
        );
        break;

      case "get_recent_guide_sessions":
        result = getRecentGuideSessions(args.learner_id, args.limit);
        break;

      // Group D
      case "recalc_aggregates_for_period":
        result = recalcAggregatesForPeriod(args.learner_id, args.period);
        break;

      case "get_aggregate_trends":
        result = getAggregateTrends(
          args.learner_id,
          args.metric_keys,
          args.period
        );
        break;

      // Group E
      case "read_entities":
        result = readEntities(args.entity_type, args.filters, args.limit);
        break;

      case "upsert_entity":
        result = upsertEntity(args.entity_type, args.entity_id, args.data);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Digital Twin MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
