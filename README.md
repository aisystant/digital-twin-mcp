# Digital Twin MCP Server

MCP (Model Context Protocol) server for Digital Twin learner data. Provides tools for AI Guide (Проводник) to work with learner profiles, learning stages, personalized routes, and performance metrics.

## Overview

This server implements the architecture described in [MCP-сервер цифрового двойника 3.2](./ecosystem-development/content/3.%20Экосистема%20развития%20%28Система%20создания%29/3.2.%20Архитектура%20—%20Платформа%20и%20подсистемы/3.2.3.%20ИТ-системы/3.2.3.1.%20Цифровой%20двойник/MCP-сервер%20цифрового%20двойника%203.2.md).

### Key Features

- **15 MCP Tools** organized in 5 functional groups (A-E)
- **Learner Stage Management** - track progression through 5 learning stages
- **Learning Routes** - create and manage personalized learning paths
- **Metrics & Analytics** - core performance indicators and trends
- **Session Logging** - record AI Guide interactions
- **Dual Deployment** - stdio for local MCP clients + HTTP API for Cloudflare Workers

## Architecture

```
┌─────────────────────────────────────┐
│  AI Guide (LLM with MCP client)     │
│  - Analyzes learner state           │
│  - Calls MCP tools                  │
│  - Provides guidance                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  MCP Server (this project)          │
│  - 15 tools in 5 groups             │
│  - Read/write operations            │
│  - Data aggregation                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Data Store                         │
│  - Learner profiles                 │
│  - Metrics (2.*)                    │
│  - Routes & sessions                │
└─────────────────────────────────────┘
```

## Available Tools

### Group A: Diagnostics and Learner Stages

| Tool | Description |
|------|-------------|
| `get_learner_summary` | Summary for a learner for a specified period (hours, sessions, tasks) |
| `get_learner_core_metrics` | Core derived metrics (2.*) for stage analysis |
| `get_stage_history` | History of learner stage changes |
| `upsert_learner_stage_evaluation` | Record or update learner stage evaluation |

### Group B: Routes and Route Steps

| Tool | Description |
|------|-------------|
| `get_learning_route` | Get current learning route for a learner |
| `upsert_learning_route` | Create or update learning route with goals and steps |
| `update_route_step_status` | Update status of a specific route step |

### Group C: Guide Sessions and Events

| Tool | Description |
|------|-------------|
| `log_guide_session` | Record a guide session (type, summary, actions) |
| `get_recent_guide_sessions` | Get recent guide sessions for dialog context |

### Group D: Aggregates and Dynamics

| Tool | Description |
|------|-------------|
| `recalc_aggregates_for_period` | Recalculate derived metrics for a period |
| `get_aggregate_trends` | Get time series trends for specified metrics |

### Group E: Universal Tools

| Tool | Description |
|------|-------------|
| `read_entities` | Generic tool to read entities by filters |
| `upsert_entity` | Generic tool to create or update an entity |

## Learning Stages (Ступени Ученика)

The system tracks learners through 5 progressive stages:

1. **Случайный** (Random) - Chaotic learning, inconsistent engagement
2. **Практикующий** (Practicing) - 15+ minutes daily practice established
3. **Систематический** (Systematic) - Consistent 4+ week learning patterns
4. **Дисциплинированный** (Disciplined) - 10+ hours/week for 2-3+ months
5. **Проактивный** (Proactive) - Self-directed, initiative-driven learning

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account (for deployment)
- Wrangler CLI (for Cloudflare Workers)

### Install Dependencies

```bash
npm install
```

## Usage

### Option 1: Local MCP Server (stdio)

For use with MCP clients like Claude Desktop or custom AI applications:

```bash
node src/index.js
```

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "digital-twin": {
      "command": "node",
      "args": ["/path/to/digital-twin-mcp/src/index.js"]
    }
  }
}
```

### Option 2: Cloudflare Workers (HTTP API)

#### Local Development

```bash
npm run dev
```

This starts the development server at `http://localhost:8787`

#### Test Endpoints

```bash
# Health check
curl http://localhost:8787/

# List all tools
curl http://localhost:8787/tools

# Call a tool
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "get_learner_summary",
    "arguments": {
      "learner_id": "learner_001"
    }
  }'
```

#### Deploy to Cloudflare

1. **Login to Cloudflare**

```bash
npx wrangler login
```

2. **Update wrangler.toml**

Edit `wrangler.toml` and add your account ID:

```toml
account_id = "your-cloudflare-account-id"
```

3. **Deploy**

```bash
npm run deploy
```

4. **Your API will be available at:**

```
https://digital-twin-mcp.your-account.workers.dev
```

## API Examples

### Get Learner Summary

```bash
curl -X POST https://your-worker.workers.dev/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "get_learner_summary",
    "arguments": {
      "learner_id": "learner_001",
      "period_start": "2024-11-01",
      "period_end": "2024-12-01"
    }
  }'
```

Response:

```json
{
  "tool": "get_learner_summary",
  "result": {
    "learnerId": "learner_001",
    "period": {
      "start": "2024-11-01",
      "end": "2024-12-01"
    },
    "summary": {
      "id": "learner_001",
      "name": "Sample Learner",
      "totalHours": 45.5,
      "sessions": 23,
      "pomodoros": 67,
      "completedTasks": 15,
      "clubActivity": 8
    }
  },
  "timestamp": "2024-12-14T10:30:00.000Z"
}
```

### Get Core Metrics

```bash
curl -X POST https://your-worker.workers.dev/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "get_learner_core_metrics",
    "arguments": {
      "learner_id": "learner_001",
      "period": "4_weeks"
    }
  }'
```

Response:

```json
{
  "tool": "get_learner_core_metrics",
  "result": {
    "learnerId": "learner_001",
    "period": "4_weeks",
    "metrics": {
      "2.1.1": { "value": 45.5, "label": "Total hours", "trend": "up" },
      "2.1.2": { "value": 4.2, "label": "Sessions per week", "trend": "stable" },
      "2.2.1": { "value": 0.75, "label": "Practice regularity", "trend": "up" },
      "2.4.2": { "value": "Практикующий", "label": "Current stage" },
      "2.10.1": { "value": "motivation_gaps", "label": "Stuck profile" }
    },
    "calculatedAt": "2024-12-14T10:30:00.000Z"
  }
}
```

### Update Stage Evaluation

```bash
curl -X POST https://your-worker.workers.dev/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "upsert_learner_stage_evaluation",
    "arguments": {
      "learner_id": "learner_001",
      "stage": "Систематический",
      "reason": "Maintained 4+ weeks of consistent daily practice",
      "metrics_snapshot": {
        "hours": 45.5,
        "regularity": 0.85,
        "weeks_consistent": 5
      }
    }
  }'
```

### Create Learning Route

```bash
curl -X POST https://your-worker.workers.dev/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "upsert_learning_route",
    "arguments": {
      "learner_id": "learner_001",
      "route_data": {
        "goals": "Transition to Systematic stage: 30+ min daily for 4+ weeks",
        "steps": [
          {
            "id": "step_001",
            "title": "Morning learning slot 20 min",
            "status": "pending",
            "priority": 1
          },
          {
            "id": "step_002",
            "title": "Weekly reflection 1 hour",
            "status": "pending",
            "priority": 2
          }
        ]
      }
    }
  }'
```

## Use Cases

### Scenario 1: Initial Learner Assessment

AI Guide uses these tools to assess a new learner:

1. `get_learner_summary` - get basic activity data
2. `get_learner_core_metrics` - analyze stage indicators
3. `upsert_learner_stage_evaluation` - record initial stage
4. `upsert_learning_route` - create first personalized route
5. `log_guide_session` - log the assessment session

### Scenario 2: Weekly Progress Review

For regular check-ins:

1. `get_learner_summary` - last week's activity
2. `get_learner_core_metrics` - 4-week trends
3. `get_learning_route` - current route progress
4. `update_route_step_status` - mark completed steps
5. `log_guide_session` - record the session

### Scenario 3: Stage Transition

When learner is ready to progress:

1. `get_stage_history` - review progression history
2. `get_learner_core_metrics` - verify transition criteria
3. `upsert_learner_stage_evaluation` - record new stage
4. `upsert_learning_route` - create transition route
5. `log_guide_session` - document the transition

## Data Model

### Learner Stages Flow

```
Случайный → Практикующий → Систематический → Дисциплинированный → Проактивный
(Random)    (Practicing)   (Systematic)      (Disciplined)        (Proactive)
```

### Key Metrics (2.*)

- **2.1.*** - Hours and regularity
- **2.2.*** - Practice and mastery level
- **2.3.*** - Questions and reflection quality
- **2.4.2** - Current learner stage
- **2.10.1** - Stuck profile (barriers to progress)

## Configuration

### Environment Variables

For production deployment, set these secrets in Cloudflare:

```bash
# API authentication (optional)
wrangler secret put API_KEY

# Database connection (when implementing real DB)
wrangler secret put DATABASE_URL
```

### Mock Data vs Production

**Current Version (v1.0):**
- Uses in-memory mock data
- Data resets on worker restart
- Perfect for testing and development

**Future Enhancements:**
- Connect to SurrealDB or PostgreSQL
- Use Cloudflare D1 for SQL storage
- Use Cloudflare KV for caching
- Implement authentication

## Development

### Project Structure

```
digital-twin-mcp/
├── src/
│   ├── index.js          # MCP server (stdio)
│   └── worker.js         # Cloudflare Workers (HTTP)
├── ecosystem-development/
│   └── content/          # Specification docs
├── package.json
├── wrangler.toml         # Cloudflare config
└── README.md
```

### Testing Tools

```bash
# Test stdio server locally
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node src/index.js

# Test HTTP API locally
npm run dev
curl http://localhost:8787/tools
```

### Adding New Tools

1. Define tool schema in `src/index.js` (ListToolsRequestSchema handler)
2. Implement tool logic in CallToolRequestSchema handler
3. Add HTTP endpoint in `src/worker.js`
4. Update documentation

## Monitoring

### Health Checks

```bash
# Check if worker is running
curl https://your-worker.workers.dev/

# List available tools
curl https://your-worker.workers.dev/tools
```

### Logging

Cloudflare Workers logs available via:

```bash
wrangler tail
```

## Security

### Current Status (v1.0)

- ⚠️ No authentication (development only)
- ⚠️ CORS open to all origins
- ⚠️ No rate limiting
- ⚠️ Mock data only

### Production Recommendations

- [ ] Add API key authentication
- [ ] Implement rate limiting
- [ ] Restrict CORS to specific origins
- [ ] Use HTTPS only
- [ ] Encrypt sensitive learner data
- [ ] Implement audit logging

## Roadmap

### v1.0 (Current)
- ✅ All 15 MCP tools implemented
- ✅ Mock data store
- ✅ Cloudflare Workers deployment
- ✅ HTTP API endpoints

### v1.1 (Next)
- [ ] Connect to real database (SurrealDB/PostgreSQL)
- [ ] API authentication
- [ ] Rate limiting
- [ ] Automated tests

### v2.0 (Future)
- [ ] Real-time metrics calculation
- [ ] Advanced analytics tools
- [ ] Multi-tenant support
- [ ] GraphQL API
- [ ] WebSocket support for live updates

## Related Documentation

- [MCP Server Specification](./ecosystem-development/content/3.%20Экосистема%20развития%20%28Система%20создания%29/3.2.%20Архитектура%20—%20Платформа%20и%20подсистемы/3.2.3.%20ИТ-системы/3.2.3.1.%20Цифровой%20двойник/MCP-сервер%20цифрового%20двойника%203.2.md)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev`
5. Submit a pull request

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [Create an issue](#)
- Documentation: See `ecosystem-development/content/`
- MCP Protocol: https://modelcontextprotocol.io/

---

**Version:** 1.0.0
**Last Updated:** 2024-12-14
**Status:** Development (Mock Data)