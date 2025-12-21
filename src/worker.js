// Cloudflare Workers entry point for Digital Twin MCP Server
// This handles HTTP requests and translates them to MCP protocol

// Note: This file shares mock data initialization with worker-sse.js
// For production deployment, use worker-sse.js which implements full MCP protocol

// Mock data store
const mockData = {
  learners: new Map(),
  routes: new Map(),
  sessions: new Map(),
  stageHistory: new Map(),
  aggregates: new Map(),
};

// Initialize with sample data matching JSON schemas from spec
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

// Tool implementations
const tools = {
  get_learner_summary: (args) => {
    const learner_id = args.learner_id || "learner_001";
    const learner = mockData.learners.get(learner_id);
    if (!learner) throw new Error(`Learner ${learner_id} not found`);

    const period_start = args.period_start || "2025-11-20";
    const period_end = args.period_end || "2025-12-20";

    return {
      ...learner,
      period: {
        start: period_start,
        end: period_end
      }
    };
  },

  get_learner_core_metrics: (args) => {
    const learner_id = args.learner_id || "learner_001";
    const data = mockData.aggregates.get(learner_id);
    if (!data) throw new Error(`Metrics for learner ${learner_id} not found`);

    const period = args.period || "4_weeks";
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
  },

  get_stage_history: (args) => {
    const learner_id = args.learner_id || "learner_001";
    const history = mockData.stageHistory.get(learner_id) || [];
    const limit = args.limit || 10;
    const current_stage = mockData.aggregates.get(learner_id)?.metrics["2.4.2_current_stage"] || "Случайный";

    return {
      history: history.slice(0, limit),
      total_entries: history.length,
      current_stage: current_stage
    };
  },

  upsert_learner_stage_evaluation: (args) => {
    const learner_id = args.learner_id || "learner_001";
    const history = mockData.stageHistory.get(learner_id) || [];
    const previous_stage = mockData.aggregates.get(learner_id)?.metrics["2.4.2_current_stage"] || null;
    const is_transition = previous_stage && previous_stage !== args.stage;

    const newEntry = {
      date: new Date().toISOString().split('T')[0],
      stage: args.stage,
      previous_stage: previous_stage,
      reason: args.reason,
      key_metrics: args.metrics_snapshot || {},
      session_id: `session_${Date.now()}`
    };

    history.unshift(newEntry);
    mockData.stageHistory.set(learner_id, history);

    const metrics = mockData.aggregates.get(learner_id);
    if (metrics) metrics.metrics["2.4.2_current_stage"] = args.stage;

    return {
      success: true,
      evaluation_id: `eval_${new Date().toISOString().split('T')[0]}_${Date.now().toString(36)}`,
      previous_stage: previous_stage,
      new_stage: args.stage,
      is_transition: is_transition,
      recorded_at: new Date().toISOString()
    };
  },

  get_learning_route: (args) => {
    const learner_id = args.learner_id || "learner_001";
    const route = mockData.routes.get(learner_id);
    if (!route) throw new Error(`Route for learner ${learner_id} not found`);
    return route;
  },

  upsert_learning_route: (args) => {
    const learner_id = args.learner_id || "learner_001";
    const existingRoute = mockData.routes.get(learner_id);
    const is_new = !existingRoute;
    const version = existingRoute ? existingRoute.version + 1 : 1;

    const route = {
      route_id: existingRoute?.route_id || `route_${learner_id}_v${version}`,
      version: version,
      created_at: existingRoute?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      stage_focus: args.route_data?.stage_target || "Случайный",
      goals: args.route_data?.goals || [],
      steps: args.route_data?.steps || [],
      statistics: {
        total_steps: (args.route_data?.steps || []).length,
        completed: 0,
        in_progress: 0,
        pending: (args.route_data?.steps || []).length
      }
    };

    mockData.routes.set(learner_id, route);

    const estimated_total_hours = (args.route_data?.steps || []).reduce((sum, step) => {
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
  },

  update_route_step_status: (args) => {
    const learner_id = args.learner_id || "learner_001";
    const route = mockData.routes.get(learner_id);
    if (!route) throw new Error(`Route for learner ${learner_id} not found`);

    const step = route.steps.find(s => s.id === args.step_id);
    if (!step) throw new Error(`Step ${args.step_id} not found`);

    const previous_status = step.status;
    step.status = args.new_status;
    if (args.comment) step.comment = args.comment;
    if (args.actual_minutes) step.actual_minutes = args.actual_minutes;

    const updated_at = new Date().toISOString();
    step.updated_at = updated_at;

    if (args.new_status === "completed" && !step.completed_at) {
      step.completed_at = updated_at;
    }

    route.updated_at = updated_at;

    route.statistics = {
      total_steps: route.steps.length,
      completed: route.steps.filter(s => s.status === "completed").length,
      in_progress: route.steps.filter(s => s.status === "in_progress").length,
      pending: route.steps.filter(s => s.status === "pending").length
    };

    mockData.routes.set(learner_id, route);

    return {
      success: true,
      step_id: args.step_id,
      step_title: step.title,
      previous_status: previous_status,
      new_status: args.new_status,
      updated_at: updated_at,
      route_progress: {
        completed: route.statistics.completed,
        total: route.statistics.total_steps,
        percentage: Math.round((route.statistics.completed / route.statistics.total_steps) * 1000) / 10
      }
    };
  },

  log_guide_session: (args) => {
    const learner_id = args.learner_id || "learner_001";
    const sessions = mockData.sessions.get(learner_id) || [];
    const session_id = `session_${new Date().toISOString().split('T')[0]}_${Date.now().toString(36)}`;

    const session = {
      session_id: session_id,
      date: new Date().toISOString().split('T')[0],
      type: args.session_type,
      summary: `${args.input_summary}. Действия: ${(args.actions || []).join(', ')}. Результат: ${args.outcome || 'Сессия завершена'}`,
      decisions: args.actions || [],
      outcome: args.outcome || "Сессия завершена"
    };

    sessions.unshift(session);
    mockData.sessions.set(learner_id, sessions);

    return {
      success: true,
      session_id: session_id,
      session_type: args.session_type,
      recorded_at: new Date().toISOString(),
      duration_estimate: "15 минут"
    };
  },

  get_recent_guide_sessions: (args) => {
    const learner_id = args.learner_id || "learner_001";
    const sessions = mockData.sessions.get(learner_id) || [];
    const limit = args.limit || 5;
    const recentSessions = sessions.slice(0, limit);

    return {
      sessions: recentSessions,
      total_sessions: sessions.length,
      period_covered: {
        from: recentSessions[recentSessions.length - 1]?.date || new Date().toISOString().split('T')[0],
        to: recentSessions[0]?.date || new Date().toISOString().split('T')[0]
      }
    };
  },

  recalc_aggregates_for_period: (args) => {
    const start_time = Date.now();

    const metrics_updated = [
      "2.1.1_hours_per_week",
      "2.1.2_regularity_index",
      "2.2.7_mastery_index"
    ];

    const processing_time = Date.now() - start_time;

    return {
      success: true,
      period: args.period,
      metrics_updated: metrics_updated,
      recalculated_at: new Date().toISOString(),
      processing_time_ms: processing_time + 245
    };
  },

  get_aggregate_trends: (args) => {
    const period = args.period || "8_weeks";
    const weeks = parseInt(period.split('_')[0]) || 8;

    const trends = {};
    const dates = [];

    for (let i = weeks - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i * 7);
      dates.push(date.toISOString().split('T')[0]);
    }

    (args.metric_keys || args.metrics || []).forEach(metricKey => {
      if (metricKey === "2.1.1_hours_per_week") {
        trends[metricKey] = {
          values: [1.5, 2.0, 2.5, 3.0, 2.8, 3.2, 3.5, 4.0].slice(-weeks),
          dates: dates,
          trend: "growing",
          change_percent: 166.7
        };
      } else if (metricKey === "2.1.2_regularity_index") {
        trends[metricKey] = {
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
  },

  read_entities: (args) => {
    const mockEntities = [];

    if (args.entity_type === "slot") {
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
  },

  upsert_entity: (args) => {
    const entity_id = args.entity_id || `${args.entity_type}_${Date.now()}`;
    const operation = args.entity_id ? "updated" : "created";

    return {
      success: true,
      entity_id: entity_id,
      entity_type: args.entity_type,
      operation: operation,
      timestamp: new Date().toISOString()
    };
  },
};

// Tool definitions for API documentation
const toolDefinitions = [
  { name: "get_learner_summary", description: "Сводка по ученику за период", group: "A - Diagnostics" },
  { name: "get_learner_core_metrics", description: "Ядро производных показателей для анализа ступени", group: "A - Diagnostics" },
  { name: "get_stage_history", description: "История смены ступеней", group: "A - Diagnostics" },
  { name: "upsert_learner_stage_evaluation", description: "Записать оценку ступени", group: "A - Diagnostics" },
  { name: "get_learning_route", description: "Получить маршрут ученика", group: "B - Routes" },
  { name: "upsert_learning_route", description: "Создать/обновить маршрут", group: "B - Routes" },
  { name: "update_route_step_status", description: "Обновить статус шага", group: "B - Routes" },
  { name: "log_guide_session", description: "Зафиксировать сессию Проводника", group: "C - Sessions" },
  { name: "get_recent_guide_sessions", description: "Получить последние сессии", group: "C - Sessions" },
  { name: "recalc_aggregates_for_period", description: "Пересчитать показатели", group: "D - Aggregates" },
  { name: "get_aggregate_trends", description: "Получить динамику показателей", group: "D - Aggregates" },
  { name: "read_entities", description: "Читать сущности", group: "E - Universal" },
  { name: "upsert_entity", description: "Создать/обновить сущность", group: "E - Universal" },
];

// Initialize data on worker start
initializeMockData();

// Default learner ID (in production, this would come from authentication/session)
const DEFAULT_LEARNER_ID = "learner_001";

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
        description: 'Demo version with mock data matching MCP spec v2.0',
        defaultLearnerId: DEFAULT_LEARNER_ID,
        endpoints: {
          health: '/',
          tools: '/tools',
          call: '/call (POST)',
          docs: '/docs'
        },
      }, null, 2), {
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
        defaultLearnerId: DEFAULT_LEARNER_ID,
        note: "For full MCP protocol support, use /mcp endpoint (see worker-sse.js)"
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

        // Inject default learner_id if not provided
        const enhancedArgs = { learner_id: DEFAULT_LEARNER_ID, ...args };
        const result = toolFn(enhancedArgs);

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

    // Documentation endpoint
    if (url.pathname === '/docs') {
      return new Response(JSON.stringify({
        name: "Digital Twin MCP Server - HTTP API",
        version: "1.0.0",
        description: "Simplified HTTP interface for testing. For full MCP protocol, use worker-sse.js",
        defaultLearnerId: DEFAULT_LEARNER_ID,
        endpoints: {
          health: "GET / - Server health and info",
          tools: "GET /tools - List all available tools",
          call: "POST /call - Call a tool with arguments",
          docs: "GET /docs - This documentation"
        },
        usage: {
          listTools: "GET /tools",
          callTool: {
            method: "POST",
            url: "/call",
            body: {
              tool: "get_learner_summary",
              arguments: {
                period_start: "2025-11-20",
                period_end: "2025-12-20"
              }
            }
          }
        },
        tools: toolDefinitions,
        note: "This is a demo with mock data. learner_id defaults to 'learner_001' if not provided."
      }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 404 for unknown paths
    return new Response(JSON.stringify({
      error: 'Not found',
      path: url.pathname,
      availableEndpoints: ['/', '/tools', '/call', '/docs'],
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
