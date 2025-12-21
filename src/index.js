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

// Initialize with sample data matching JSON schemas from MCP spec v2.0
function initializeMockData() {
  const learnerId = "learner_001";

  // A1: get_learner_summary data
  mockData.learners.set(learnerId, {
    total_hours: 12.5,
    sessions_count: 18,
    pomodoros_completed: 45,
    tasks_completed: 7,
    club_posts: 3,
    club_comments: 12,
    days_with_activity: 15,
    avg_daily_minutes: 26,
  });

  // A2: get_learner_core_metrics data
  mockData.aggregates.set(learnerId, {
    metrics: {
      "2.1.1_hours_per_week": 3.2,
      "2.1.2_regularity_index": 0.42,
      "2.1.3_daily_slot_minutes": 15,
      "2.1.6_consistency_score": 2.1,
      "2.2.1_practice_score": 15,
      "2.2.7_mastery_index": 0.18,
      "2.3.1_reflection_count": 2,
      "2.3.2_question_quality_index": 0.35,
      "2.4.2_current_stage": "Случайный",
      "2.10.1_stagnation_profile": "Хаос"
    },
    interpretation: {
      regularity: "low",
      stage_confidence: 0.85,
      transition_readiness: 0.2,
      risk_factors: ["irregular_schedule", "no_daily_slot"]
    }
  });

  // A3: get_stage_history data
  mockData.stageHistory.set(learnerId, [
    {
      date: "2025-12-15",
      stage: "Случайный",
      previous_stage: null,
      reason: "Первичная диагностика",
      key_metrics: {
        hours_per_week: 1.5,
        regularity_index: 0.14
      },
      session_id: "session_2025-12-15_abc"
    },
    {
      date: "2025-11-01",
      stage: "Практикующий",
      previous_stage: "Случайный",
      reason: "Появился стабильный слот 20 мин/день",
      key_metrics: {
        hours_per_week: 4.2,
        regularity_index: 0.57
      },
      session_id: "session_2025-11-01_def"
    }
  ]);

  // B1: get_learning_route data
  mockData.routes.set(learnerId, {
    route_id: "route_user123_v3",
    version: 3,
    created_at: "2025-12-10T08:00:00Z",
    updated_at: "2025-12-18T14:30:00Z",
    stage_focus: "Случайный",
    goals: [
      {
        id: "goal_1",
        description: "Выйти на 15+ минут ежедневного слота",
        target_date: "2025-12-31",
        progress: 0.4,
        status: "in_progress"
      }
    ],
    steps: [
      {
        id: "step_1",
        title: "Установить напоминание на 8:00",
        description: "Настроить ежедневное напоминание о слоте саморазвития",
        type: "setup",
        priority: 1,
        status: "completed",
        started_at: "2025-12-10T08:00:00Z",
        completed_at: "2025-12-12T09:15:00Z"
      },
      {
        id: "step_2",
        title: "Провести первую неделю с 15-минутным слотом",
        description: "Ежедневно выделять 15 минут на чтение руководства",
        type: "daily_habit",
        priority: 1,
        status: "in_progress",
        started_at: "2025-12-13T08:00:00Z",
        completed_at: null,
        progress_notes: "5 из 7 дней выполнено"
      },
      {
        id: "step_3",
        title: "Рефлексия по итогам недели",
        description: "Написать короткий отчёт о первой неделе",
        type: "reflection",
        priority: 2,
        status: "pending",
        depends_on: ["step_2"]
      }
    ],
    statistics: {
      total_steps: 3,
      completed: 1,
      in_progress: 1,
      pending: 1
    }
  });

  // C2: get_recent_guide_sessions data
  mockData.sessions.set(learnerId, [
    {
      session_id: "session_2025-12-15_abc",
      date: "2025-12-15",
      type: "weekly",
      summary: "Диагностика, ступень Случайный, создан маршрут на неделю",
      decisions: [
        "Цель: 15 минут/день",
        "Установить напоминание на 8:00"
      ],
      outcome: "Маршрут принят пользователем"
    },
    {
      session_id: "session_2025-12-08_def",
      date: "2025-12-08",
      type: "initial",
      summary: "Первичная диагностика нового ученика",
      decisions: [
        "Определена ступень Случайный",
        "Профиль застревания: Хаос"
      ],
      outcome: "Создан первый маршрут"
    }
  ]);
}

// Initialize mock data
initializeMockData();

// Helper functions matching JSON output schemas

// A1: get_learner_summary
function getLearnerSummary(learnerId, periodStart, periodEnd) {
  const learner = mockData.learners.get(learnerId);
  if (!learner) {
    throw new Error(`Learner ${learnerId} not found`);
  }

  const period_start = periodStart || "2025-11-20";
  const period_end = periodEnd || "2025-12-20";

  return {
    ...learner,
    period: {
      start: period_start,
      end: period_end
    }
  };
}

// A2: get_learner_core_metrics
function getLearnerCoreMetrics(learnerId, period = "4_weeks") {
  const data = mockData.aggregates.get(learnerId);
  if (!data) {
    throw new Error(`Metrics for learner ${learnerId} not found`);
  }

  const weeks = period === "4_weeks" ? 4 : period === "8_weeks" ? 8 : 12;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - weeks * 7);

  return {
    metrics: data.metrics,
    interpretation: data.interpretation,
    period: {
      weeks: weeks,
      start: startDate.toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    }
  };
}

// A3: get_stage_history
function getStageHistory(learnerId, limit = 10) {
  const history = mockData.stageHistory.get(learnerId) || [];
  const current_stage = mockData.aggregates.get(learnerId)?.metrics["2.4.2_current_stage"] || "Случайный";

  return {
    history: history.slice(0, limit),
    total_entries: history.length,
    current_stage: current_stage
  };
}

// A4: upsert_learner_stage_evaluation
function upsertLearnerStageEvaluation(learnerId, stage, reason, metricsSnapshot) {
  const history = mockData.stageHistory.get(learnerId) || [];
  const previous_stage = mockData.aggregates.get(learnerId)?.metrics["2.4.2_current_stage"] || null;
  const is_transition = previous_stage && previous_stage !== stage;

  const newEntry = {
    date: new Date().toISOString().split('T')[0],
    stage,
    previous_stage: previous_stage,
    reason,
    key_metrics: metricsSnapshot || {},
    session_id: `session_${Date.now()}`
  };

  history.unshift(newEntry);
  mockData.stageHistory.set(learnerId, history);

  // Update current stage in aggregates
  const metrics = mockData.aggregates.get(learnerId);
  if (metrics) {
    metrics.metrics["2.4.2_current_stage"] = stage;
  }

  return {
    success: true,
    evaluation_id: `eval_${new Date().toISOString().split('T')[0]}_${Date.now().toString(36)}`,
    previous_stage: previous_stage,
    new_stage: stage,
    is_transition: is_transition,
    recorded_at: new Date().toISOString()
  };
}

// B1: get_learning_route
function getLearningRoute(learnerId) {
  const route = mockData.routes.get(learnerId);
  if (!route) {
    throw new Error(`Route for learner ${learnerId} not found`);
  }

  return route;
}

// B2: upsert_learning_route
function upsertLearningRoute(learnerId, routeData) {
  const existingRoute = mockData.routes.get(learnerId);
  const is_new = !existingRoute;
  const version = existingRoute ? existingRoute.version + 1 : 1;

  const route = {
    route_id: existingRoute?.route_id || `route_${learnerId}_v${version}`,
    version: version,
    created_at: existingRoute?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stage_focus: routeData.stage_target || "Случайный",
    goals: routeData.goals || [],
    steps: routeData.steps || [],
    statistics: {
      total_steps: (routeData.steps || []).length,
      completed: 0,
      in_progress: 0,
      pending: (routeData.steps || []).length
    }
  };

  mockData.routes.set(learnerId, route);

  // Calculate estimated hours
  const estimated_total_hours = (routeData.steps || []).reduce((sum, step) => {
    return sum + ((step.estimated_minutes || 0) / 60);
  }, 0);

  return {
    success: true,
    route_id: route.route_id,
    version: route.version,
    is_new: is_new,
    goals_count: route.goals.length,
    steps_count: route.steps.length,
    created_at: route.updated_at,
    estimated_total_hours: Math.round(estimated_total_hours * 10) / 10
  };
}

// B3: update_route_step_status
function updateRouteStepStatus(learnerId, stepId, newStatus, comment, actualMinutes) {
  const route = mockData.routes.get(learnerId);
  if (!route) {
    throw new Error(`Route for learner ${learnerId} not found`);
  }

  const step = route.steps.find(s => s.id === stepId);
  if (!step) {
    throw new Error(`Step ${stepId} not found in route`);
  }

  const previous_status = step.status;
  step.status = newStatus;
  if (comment) step.comment = comment;
  if (actualMinutes) step.actual_minutes = actualMinutes;

  const updated_at = new Date().toISOString();
  step.updated_at = updated_at;

  if (newStatus === "completed" && !step.completed_at) {
    step.completed_at = updated_at;
  }

  route.updated_at = updated_at;

  // Recalculate statistics
  route.statistics = {
    total_steps: route.steps.length,
    completed: route.steps.filter(s => s.status === "completed").length,
    in_progress: route.steps.filter(s => s.status === "in_progress").length,
    pending: route.steps.filter(s => s.status === "pending").length
  };

  mockData.routes.set(learnerId, route);

  return {
    success: true,
    step_id: stepId,
    step_title: step.title,
    previous_status: previous_status,
    new_status: newStatus,
    updated_at: updated_at,
    route_progress: {
      completed: route.statistics.completed,
      total: route.statistics.total_steps,
      percentage: Math.round((route.statistics.completed / route.statistics.total_steps) * 1000) / 10
    }
  };
}

// C1: log_guide_session
function logGuideSession(learnerId, sessionType, inputSummary, actions, outcome) {
  const sessions = mockData.sessions.get(learnerId) || [];
  const session_id = `session_${new Date().toISOString().split('T')[0]}_${Date.now().toString(36)}`;

  const session = {
    session_id: session_id,
    date: new Date().toISOString().split('T')[0],
    type: sessionType,
    summary: `${inputSummary}. Действия: ${actions.join(', ')}. Результат: ${outcome || 'Сессия завершена'}`,
    decisions: actions,
    outcome: outcome || "Сессия завершена"
  };

  sessions.unshift(session);
  mockData.sessions.set(learnerId, sessions);

  return {
    success: true,
    session_id: session_id,
    session_type: sessionType,
    recorded_at: new Date().toISOString(),
    duration_estimate: "15 минут"
  };
}

// C2: get_recent_guide_sessions
function getRecentGuideSessions(learnerId, limit = 5) {
  const sessions = mockData.sessions.get(learnerId) || [];
  const recentSessions = sessions.slice(0, limit);

  return {
    sessions: recentSessions,
    total_sessions: sessions.length,
    period_covered: {
      from: recentSessions[recentSessions.length - 1]?.date || new Date().toISOString().split('T')[0],
      to: recentSessions[0]?.date || new Date().toISOString().split('T')[0]
    }
  };
}

// D1: recalc_aggregates_for_period
function recalcAggregatesForPeriod(learnerId, period) {
  const start_time = Date.now();

  // Simulate recalculation
  const metrics_updated = [
    "2.1.1_hours_per_week",
    "2.1.2_regularity_index",
    "2.2.7_mastery_index"
  ];

  const processing_time = Date.now() - start_time;

  return {
    success: true,
    period: period,
    metrics_updated: metrics_updated,
    recalculated_at: new Date().toISOString(),
    processing_time_ms: processing_time + 245
  };
}

// D2: get_aggregate_trends
function getAggregateTrends(learnerId, metricKeys, period) {
  const weeks = parseInt((period || "8_weeks").split('_')[0]) || 8;

  const trends = {};
  const dates = [];

  // Generate dates
  for (let i = weeks - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i * 7);
    dates.push(date.toISOString().split('T')[0]);
  }

  metricKeys.forEach(key => {
    if (key === "2.1.1_hours_per_week") {
      trends[key] = {
        values: [1.5, 2.0, 2.5, 3.0, 2.8, 3.2, 3.5, 4.0].slice(-weeks),
        dates: dates,
        trend: "growing",
        change_percent: 166.7
      };
    } else if (key === "2.1.2_regularity_index") {
      trends[key] = {
        values: [0.14, 0.21, 0.28, 0.35, 0.32, 0.42, 0.50, 0.57].slice(-weeks),
        dates: dates,
        trend: "growing",
        change_percent: 307.1
      };
    }
  });

  return {
    trends: trends,
    period: {
      weeks: weeks,
      start: dates[0],
      end: dates[dates.length - 1]
    },
    summary: "Положительная динамика по обоим показателям"
  };
}

// E1: read_entities
function readEntities(entityType, filters, limit = 100) {
  // Mock generic entity reader
  const mockEntities = [];

  if (entityType === "slot") {
    mockEntities.push({
      id: "slot_123",
      type: "slot",
      date: "2025-12-19",
      duration_minutes: 25,
      status: "completed",
      activity_type: "reading"
    });
  }

  return {
    entities: mockEntities,
    total_count: mockEntities.length,
    returned_count: mockEntities.length,
    has_more: false
  };
}

// E2: upsert_entity
function upsertEntity(entityType, entityId, data) {
  const entity_id = entityId || `${entityType}_${Date.now()}`;
  const operation = entityId ? "updated" : "created";

  return {
    success: true,
    entity_id: entity_id,
    entity_type: entityType,
    operation: operation,
    timestamp: new Date().toISOString()
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
        description: "Сводка по ученику за период — базовая статистика активности. Returns total hours, sessions, pomodoros, tasks, and club activity.",
        inputSchema: {
          type: "object",
          properties: {
            period_start: {
              type: "string",
              description: "Period start date (ISO format YYYY-MM-DD, optional)",
            },
            period_end: {
              type: "string",
              description: "Period end date (ISO format YYYY-MM-DD, optional)",
            },
            period: {
              type: "string",
              enum: ["4_weeks"],
              description: "Preset period (alternative to dates)"
            }
          },
          required: [],
        },
      },
      {
        name: "get_learner_core_metrics",
        description: "Ядро производных показателей (IND.2.*) для анализа ступени. Returns core metrics, interpretation, and period info.",
        inputSchema: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["4_weeks", "8_weeks", "3_months"],
              description: "Analysis period",
            },
          },
          required: [],
        },
      },
      {
        name: "get_stage_history",
        description: "История смены ступеней Ученика. Returns list of stage transitions with dates, reasons, and metrics.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of records to return (default: 10)",
            },
          },
          required: [],
        },
      },
      {
        name: "upsert_learner_stage_evaluation",
        description: "Записать или обновить оценку ступени. Creates new entry in stage history (IND.2.4.2 and IND.2.4.3).",
        inputSchema: {
          type: "object",
          properties: {
            stage: {
              type: "string",
              enum: ["Случайный", "Практикующий", "Систематический", "Дисциплинированный", "Проактивный", "Random", "Practicing", "Systematic", "Disciplined", "Proactive"],
              description: "Learner stage (Russian or English)",
            },
            reason: {
              type: "string",
              description: "Reason for this stage assessment",
            },
            metrics_snapshot: {
              type: "object",
              description: "Snapshot of key metrics at this evaluation",
            },
            confidence: {
              type: "number",
              description: "Confidence score 0-1 (optional)"
            }
          },
          required: ["stage", "reason"],
        },
      },

      // Group B: Route and Route Steps
      {
        name: "get_learning_route",
        description: "Получить текущий маршрут Ученика. Returns complete route with goals, steps, and statistics.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "upsert_learning_route",
        description: "Создать или обновить маршрут. Creates/updates route with goals and steps.",
        inputSchema: {
          type: "object",
          properties: {
            route_data: {
              type: "object",
              properties: {
                goals: {
                  type: "array",
                  description: "Array of goals",
                  items: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      target_date: { type: "string" },
                      priority: { type: "number" }
                    }
                  }
                },
                steps: {
                  type: "array",
                  description: "Array of route steps",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      type: { type: "string", enum: ["setup", "daily_habit", "weekly_reflection", "assessment"] },
                      priority: { type: "number" },
                      estimated_minutes: { type: "number" }
                    },
                  },
                },
                focus: { type: "string", description: "Focus area (e.g., 'regularity')" },
                stage_target: { type: "string", description: "Target stage" },
                notes: { type: "string", description: "Additional notes" }
              },
              required: ["goals", "steps"],
            },
          },
          required: ["route_data"],
        },
      },
      {
        name: "update_route_step_status",
        description: "Обновить статус шага маршрута. Updates step status and recalculates progress.",
        inputSchema: {
          type: "object",
          properties: {
            step_id: {
              type: "string",
              description: "Step identifier",
            },
            new_status: {
              type: "string",
              enum: ["pending", "in_progress", "completed", "skipped", "blocked"],
              description: "New step status",
            },
            comment: {
              type: "string",
              description: "Optional comment about the status change",
            },
            actual_minutes: {
              type: "number",
              description: "Actual time spent in minutes (optional)"
            }
          },
          required: ["step_id", "new_status"],
        },
      },

      // Group C: Guide Sessions and Events
      {
        name: "log_guide_session",
        description: "Зафиксировать сессию Проводника. Records guide session with type, summary, actions, and outcome.",
        inputSchema: {
          type: "object",
          properties: {
            session_type: {
              type: "string",
              enum: ["initial", "weekly", "transition", "reactivation", "check_in"],
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
            used_tools: {
              type: "array",
              items: { type: "string" },
              description: "MCP tools used in session",
            },
            outcome: {
              type: "string",
              description: "Session outcome"
            },
            next_session_hint: {
              type: "string",
              description: "Hint for next session"
            }
          },
          required: ["session_type", "input_summary", "actions"],
        },
      },
      {
        name: "get_recent_guide_sessions",
        description: "Получить последние сессии для контекста диалога. Returns recent sessions with summaries.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of sessions to return (default: 5)",
            },
          },
          required: [],
        },
      },

      // Group D: Aggregates and Dynamics
      {
        name: "recalc_aggregates_for_period",
        description: "Пересчитать производные показатели (IND.2.*) за период. Recalculates metrics from raw data.",
        inputSchema: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["day", "week", "month"],
              description: "Period to recalculate",
            },
            force: {
              type: "boolean",
              description: "Force recalculation even if recent (optional)"
            }
          },
          required: ["period"],
        },
      },
      {
        name: "get_aggregate_trends",
        description: "Получить динамику ключевых показателей. Returns time series data for specified metrics.",
        inputSchema: {
          type: "object",
          properties: {
            metric_keys: {
              type: "array",
              items: { type: "string" },
              description: "List of metric keys (e.g., ['2.1.1_hours_per_week', '2.1.2_regularity_index'])",
            },
            period: {
              type: "string",
              description: "Period for trend analysis (e.g., '8_weeks')",
            },
            granularity: {
              type: "string",
              enum: ["day", "week", "month"],
              description: "Data point granularity"
            }
          },
          required: ["metric_keys", "period"],
        },
      },

      // Group E: Universal Tools
      {
        name: "read_entities",
        description: "Читать сущности по фильтрам (универсальный доступ). Generic entity reading with filters.",
        inputSchema: {
          type: "object",
          properties: {
            entity_type: {
              type: "string",
              description: "Type of entity to read (e.g., 'slot', 'task')",
            },
            filters: {
              type: "object",
              description: "Filter criteria as key-value pairs",
            },
            limit: {
              type: "number",
              description: "Maximum number of entities to return (default: 20)",
            },
            order_by: {
              type: "string",
              description: "Field to order by"
            },
            order_direction: {
              type: "string",
              enum: ["asc", "desc"],
              description: "Sort direction"
            }
          },
          required: ["entity_type"],
        },
      },
      {
        name: "upsert_entity",
        description: "Создать или обновить сущность (универсальная запись). Generic entity create/update.",
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

// Default learner ID (in production, this would come from authentication/session)
const DEFAULT_LEARNER_ID = "learner_001";

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;
    // Use default learner ID for all learner-specific operations
    const learnerId = DEFAULT_LEARNER_ID;

    switch (name) {
      // Group A
      case "get_learner_summary":
        result = getLearnerSummary(
          learnerId,
          args.period_start,
          args.period_end
        );
        break;

      case "get_learner_core_metrics":
        result = getLearnerCoreMetrics(learnerId, args.period);
        break;

      case "get_stage_history":
        result = getStageHistory(learnerId, args.limit);
        break;

      case "upsert_learner_stage_evaluation":
        result = upsertLearnerStageEvaluation(
          learnerId,
          args.stage,
          args.reason,
          args.metrics_snapshot
        );
        break;

      // Group B
      case "get_learning_route":
        result = getLearningRoute(learnerId);
        break;

      case "upsert_learning_route":
        result = upsertLearningRoute(learnerId, args.route_data);
        break;

      case "update_route_step_status":
        result = updateRouteStepStatus(
          learnerId,
          args.step_id,
          args.new_status,
          args.comment,
          args.actual_minutes
        );
        break;

      // Group C
      case "log_guide_session":
        result = logGuideSession(
          learnerId,
          args.session_type,
          args.input_summary,
          args.actions,
          args.outcome
        );
        break;

      case "get_recent_guide_sessions":
        result = getRecentGuideSessions(learnerId, args.limit);
        break;

      // Group D
      case "recalc_aggregates_for_period":
        result = recalcAggregatesForPeriod(learnerId, args.period);
        break;

      case "get_aggregate_trends":
        result = getAggregateTrends(
          learnerId,
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
  console.error("Default learner_id: learner_001");
  console.error("Mock data loaded with JSON schemas from MCP spec v2.0");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
