# Quick Start - Deploy to Cloudflare Workers

Get your Digital Twin MCP Server running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Cloudflare account (free tier works)

## Step 1: Install Dependencies (1 min)

```bash
cd /workspaces/digital-twin-mcp
npm install
```

## Step 2: Test Locally (1 min)

```bash
# Start dev server
npm run dev
```

Open another terminal and test:

```bash
# Health check
curl http://localhost:8787/

# List all 15 tools
curl http://localhost:8787/tools

# Call a tool
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "get_learner_summary",
    "arguments": {"learner_id": "learner_001"}
  }'
```

Press `Ctrl+C` to stop the dev server.

## Step 3: Deploy to Cloudflare (3 min)

### 3.1 Login

```bash
npx wrangler login
```

This opens a browser for authentication.

### 3.2 Get Account ID

```bash
npx wrangler whoami
```

Copy your **Account ID** from the output.

### 3.3 Update Configuration

Edit `wrangler.toml` and add your account ID:

```toml
name = "digital-twin-mcp"
main = "src/worker.js"
compatibility_date = "2024-12-01"
account_id = "paste-your-account-id-here"  # <- Replace this
```

### 3.4 Deploy

```bash
npm run deploy
```

You'll get a URL like:
```
https://digital-twin-mcp.your-account.workers.dev
```

## Step 4: Test Production

```bash
# Replace with your actual URL
WORKER_URL="https://digital-twin-mcp.your-account.workers.dev"

# Test
curl $WORKER_URL/tools
```

## That's It!

Your MCP server is now live with:
- ✅ 15 tools across 5 functional groups
- ✅ Mock data for testing
- ✅ HTTP API ready for AI clients
- ✅ Global edge deployment

## Next Steps

1. **Connect to AI Guide:**
   - Use the worker URL in your AI application
   - All 15 tools are available via `/call` endpoint

2. **Integrate Real Database:**
   - Replace mock data with SurrealDB/PostgreSQL
   - See [DEPLOYMENT.md](./DEPLOYMENT.md) for details

3. **Add Authentication:**
   - Set up API keys for production
   - See security section in [README.md](./README.md)

## Testing All Tools

Here are curl commands to test each tool group:

### Group A: Diagnostics

```bash
# Get learner summary
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"get_learner_summary","arguments":{"learner_id":"learner_001"}}'

# Get core metrics
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"get_learner_core_metrics","arguments":{"learner_id":"learner_001","period":"4_weeks"}}'

# Get stage history
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"get_stage_history","arguments":{"learner_id":"learner_001"}}'

# Update stage
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"upsert_learner_stage_evaluation","arguments":{"learner_id":"learner_001","stage":"Систематический","reason":"Test"}}'
```

### Group B: Routes

```bash
# Get learning route
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"get_learning_route","arguments":{"learner_id":"learner_001"}}'

# Create/update route
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"upsert_learning_route","arguments":{"learner_id":"learner_001","route_data":{"goals":"Test","steps":[{"id":"s1","title":"Step 1","status":"pending","priority":1}]}}}'

# Update step status
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"update_route_step_status","arguments":{"learner_id":"learner_001","step_id":"step_001","new_status":"completed"}}'
```

### Group C: Sessions

```bash
# Log session
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"log_guide_session","arguments":{"learner_id":"learner_001","session_type":"weekly","input_summary":"Test session","actions":["Action 1"]}}'

# Get recent sessions
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"get_recent_guide_sessions","arguments":{"learner_id":"learner_001"}}'
```

### Group D: Aggregates

```bash
# Recalculate aggregates
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"recalc_aggregates_for_period","arguments":{"learner_id":"learner_001","period":"1_week"}}'

# Get trends
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"get_aggregate_trends","arguments":{"learner_id":"learner_001","metric_keys":["2.1.1","2.2.1"],"period":"4_weeks"}}'
```

## Monitoring

View logs in real-time:

```bash
npx wrangler tail
```

View metrics in dashboard:
```
https://dash.cloudflare.com → Workers & Pages → digital-twin-mcp
```

## Troubleshooting

**Problem:** `npm run dev` fails
- **Solution:** Make sure Node.js 18+ is installed: `node --version`

**Problem:** Can't login to Cloudflare
- **Solution:** Check browser popup blockers, try `npx wrangler login --browser=false`

**Problem:** Deploy fails
- **Solution:** Verify account_id in `wrangler.toml` matches `wrangler whoami` output

**Problem:** 404 on production URL
- **Solution:** Wait 30 seconds after deploy, then try again

## Support

- **Full Documentation:** [README.md](./README.md)
- **Deployment Guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **MCP Specification:** See `ecosystem-development/content/`

---

**Ready to deploy?** Run these commands now:

```bash
npm install
npm run dev     # Test locally
# Ctrl+C to stop
npx wrangler login
# Edit wrangler.toml with your account ID
npm run deploy  # Go live!
```
