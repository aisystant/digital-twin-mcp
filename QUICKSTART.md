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

# List all 3 tools
curl http://localhost:8787/tools

# Explore metamodel
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{"tool":"describe_by_path","arguments":{"path":"/"}}'
```

Press `Ctrl+C` to stop the dev server.

## Step 3: Deploy to Cloudflare (3 min)

### Option A: Cloudflare GitHub App (Recommended)

1. Connect your repo to Cloudflare Pages/Workers via GitHub App
2. Push to main branch
3. Auto-deploy happens automatically

### Option B: Manual Deploy

```bash
# Login
npx wrangler login

# Get Account ID
npx wrangler whoami

# Edit wrangler.toml - add your account ID
# account_id = "paste-your-account-id-here"

# Deploy
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
- ✅ 3 tools (describe_by_path, read_digital_twin, write_digital_twin)
- ✅ 4-type indicator classification (IND.1-4)
- ✅ Access control (users can only write to IND.1.*)
- ✅ Global edge deployment

## Testing All Tools

```bash
WORKER_URL="http://localhost:8787"  # or your production URL

# 1. Explore metamodel structure
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"describe_by_path","arguments":{"path":"/"}}'

# 2. List declarative indicators
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"describe_by_path","arguments":{"path":"1_declarative"}}'

# 3. List goals subgroup
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"describe_by_path","arguments":{"path":"1_declarative/1_2_goals"}}'

# 4. Read indicator definition
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"describe_by_path","arguments":{"path":"1_declarative/1_2_goals/09_Цели обучения"}}'

# 5. Read twin data
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"read_digital_twin","arguments":{"path":"/"}}'

# 6. Write to declarative path (allowed)
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"write_digital_twin","arguments":{"path":"1_declarative/goals","data":["Learn MCP"]}}'

# 7. Write to collected path (denied)
curl -X POST $WORKER_URL/call -H "Content-Type: application/json" \
  -d '{"tool":"write_digital_twin","arguments":{"path":"2_collected/time","data":100}}'
# Returns: {"error":"Access denied: users cannot write to 2_collected"}
```

## Run Unit Tests

```bash
npm test
```

Expected output: `27 tests passing`

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

## Next Steps

1. **Connect to AI Guide:**
   - Use the worker URL in your AI application
   - All 3 tools are available via `/call` endpoint

2. **Customize Metamodel:**
   - Add indicators to `metamodel/` folders
   - Run `node scripts/build-metamodel.js`
   - See [README.md](./README.md) for structure

3. **Review Access Control:**
   - Users can only write to `1_declarative/*`
   - System writes to `2_collected/*`, `3_derived/*`
   - `4_generated/*` is created on-demand

## Support

- **Full Documentation:** [README.md](./README.md)
- **Deployment Guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Strategic Map:** [MAPSTRATEGIC.md](./MAPSTRATEGIC.md)

---

**Ready to deploy?** Run these commands now:

```bash
npm install
npm test        # Verify 27 tests pass
npm run dev     # Test locally
# Ctrl+C to stop
npm run deploy  # Go live!
```
