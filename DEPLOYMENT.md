# Deployment Guide - Digital Twin MCP Server

Complete guide for deploying the Digital Twin MCP Server to Cloudflare Workers.

## Prerequisites

1. **Cloudflare Account**
   - Sign up at https://dash.cloudflare.com/sign-up
   - Free tier is sufficient for development

2. **Node.js & npm**
   - Node.js 18+ required
   - Verify: `node --version`

3. **Wrangler CLI**
   - Installed automatically with `npm install`
   - Or install globally: `npm install -g wrangler`

## Step 1: Install Dependencies

```bash
cd /workspaces/digital-twin-mcp
npm install
```

This installs:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `wrangler` - Cloudflare Workers CLI

## Step 2: Configure Wrangler

### 2.1 Login to Cloudflare

```bash
npx wrangler login
```

This opens a browser window for authentication.

### 2.2 Get Your Account ID

After logging in, get your account ID:

```bash
npx wrangler whoami
```

Output will show:
```
Account Name: Your Name
Account ID: abc123def456...
```

### 2.3 Update wrangler.toml

Edit `wrangler.toml` and uncomment the account_id line:

```toml
name = "digital-twin-mcp"
main = "src/worker.js"
compatibility_date = "2024-12-01"
account_id = "abc123def456..."  # <- Add your account ID here
```

## Step 3: Local Development

### 3.1 Start Development Server

```bash
npm run dev
```

This starts the server at `http://localhost:8787`

### 3.2 Test Endpoints

**Health Check:**
```bash
curl http://localhost:8787/
```

**List Tools:**
```bash
curl http://localhost:8787/tools
```

**Explore Metamodel:**
```bash
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "describe_by_path",
    "arguments": {"path": "/"}
  }'
```

Expected response:
```
stages:document:Shared metamodel document
degrees:document:Shared metamodel document
1_declarative:category:Declarative indicators
2_collected:category:Collected indicators
3_derived:category:Derived indicators
4_generated:category:Generated indicators
```

**Read Twin Data:**
```bash
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "read_digital_twin",
    "arguments": {"path": "/"}
  }'
```

**Write Twin Data (1_declarative only):**
```bash
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "write_digital_twin",
    "arguments": {
      "path": "1_declarative/goals",
      "data": ["Learn MCP", "Build AI Guide"]
    }
  }'
```

## Step 4: Deploy to Cloudflare Workers

### 4.1 Option A: Cloudflare GitHub App (Recommended)

1. Go to Cloudflare Dashboard → Workers & Pages
2. Create new application → Connect to Git
3. Select your GitHub repository
4. Configure build settings (defaults work)
5. Deploy

Subsequent pushes to main branch auto-deploy.

### 4.2 Option B: Manual Deploy

```bash
npm run deploy
```

This will:
1. Bundle your code
2. Upload to Cloudflare
3. Provision the worker
4. Return the deployment URL

### 4.3 Deployment Output

You'll see output like:
```
Uploaded digital-twin-mcp (1.23 sec)
Published digital-twin-mcp (0.45 sec)
  https://digital-twin-mcp.your-account.workers.dev
```

### 4.4 Test Production Deployment

```bash
# Replace with your actual URL
export WORKER_URL="https://digital-twin-mcp.your-account.workers.dev"

# Health check
curl $WORKER_URL/

# List tools
curl $WORKER_URL/tools

# Explore metamodel
curl -X POST $WORKER_URL/call \
  -H "Content-Type: application/json" \
  -d '{"tool": "describe_by_path", "arguments": {"path": "1_declarative"}}'
```

## Step 5: Environment-Specific Deployments

### 5.1 Deploy to Staging

```bash
npx wrangler deploy --env staging
```

This deploys to: `digital-twin-mcp-staging.your-account.workers.dev`

### 5.2 Deploy to Production

```bash
npx wrangler deploy --env production
```

### 5.3 Custom Domain (Optional)

1. Add domain in Cloudflare dashboard
2. Update `wrangler.toml`:

```toml
[env.production]
name = "digital-twin-mcp-prod"
routes = [
  { pattern = "api.yourdomain.com/digital-twin/*", zone_name = "yourdomain.com" }
]
```

3. Deploy:
```bash
npx wrangler deploy --env production
```

## Step 6: Monitoring & Logs

### 6.1 Tail Logs

See real-time logs:
```bash
npx wrangler tail
```

With filtering:
```bash
npx wrangler tail --env production --format pretty
```

### 6.2 View Metrics

Check Cloudflare dashboard:
- Requests per second
- Error rate
- CPU time
- Bandwidth

Dashboard: https://dash.cloudflare.com → Workers & Pages → digital-twin-mcp

## Step 7: Secrets Management (Optional)

### 7.1 Add API Key

```bash
npx wrangler secret put API_KEY
# Enter secret when prompted: your-secret-api-key
```

### 7.2 Use in Worker

Update `src/worker.js`:

```javascript
export default {
  async fetch(request, env, ctx) {
    // Check API key
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${env.API_KEY}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    // ... rest of your code
  }
}
```

### 7.3 Test with API Key

```bash
curl -H "Authorization: Bearer your-secret-api-key" \
  https://digital-twin-mcp.your-account.workers.dev/tools
```

## Troubleshooting

### Issue: "Error: No account_id found"

**Solution:** Add your account ID to `wrangler.toml`

```bash
# Get account ID
npx wrangler whoami

# Edit wrangler.toml and add:
account_id = "your-account-id"
```

### Issue: "Module not found: @modelcontextprotocol/sdk"

**Solution:** Install dependencies

```bash
npm install
```

### Issue: "Worker exceeds size limit"

**Solution:** Optimize bundle

```bash
# Check bundle size
npx wrangler deploy --dry-run

# If too large, consider:
# 1. Remove unused dependencies
# 2. Use esbuild minification
# 3. Split into multiple workers
```

### Issue: "Rate limited"

**Solution:** Cloudflare free tier limits:
- 100,000 requests/day
- 1000 requests/min

Upgrade to paid plan or implement caching.

### Issue: "CORS errors in browser"

**Solution:** CORS is already configured in `src/worker.js`

If still having issues, check:
1. Browser is not blocking third-party cookies
2. Request includes correct headers
3. OPTIONS preflight is handled

## Performance Optimization

### 1. Enable Caching

Add to `wrangler.toml`:

```toml
[site]
bucket = "./public"

[build]
command = "npm run build"
```

### 2. Use KV for Data Storage

```bash
# Create KV namespace
npx wrangler kv:namespace create "DIGITAL_TWIN_DATA"

# Add to wrangler.toml
[[kv_namespaces]]
binding = "DIGITAL_TWIN_DATA"
id = "your-kv-namespace-id"
```

Update worker to use KV:

```javascript
// Store data in KV
await env.DIGITAL_TWIN_DATA.put('learner_001', JSON.stringify(twinData));

// Read from KV
const data = await env.DIGITAL_TWIN_DATA.get('learner_001', 'json');
```

### 3. Use D1 Database

```bash
# Create D1 database
npx wrangler d1 create digital-twin-db

# Add to wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "digital-twin-db"
database_id = "your-d1-database-id"
```

## Security Checklist

Before production deployment:

- [ ] Add API key authentication
- [ ] Restrict CORS to specific origins
- [ ] Enable rate limiting
- [ ] Use HTTPS only (enforced by default)
- [ ] Sanitize user inputs
- [ ] Implement audit logging
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Review and minimize permissions
- [ ] Enable WAF (Web Application Firewall)
- [ ] Set up DDoS protection

## Cost Estimation

### Free Tier (Included)
- 100,000 requests/day
- 10ms CPU time per request
- Sufficient for development and testing

### Paid Workers Plan ($5/month)
- 10 million requests/month included
- Additional: $0.50 per million requests
- 30s CPU time per request
- Recommended for production

### Example Costs

**Scenario 1: Small deployment (100 learners)**
- ~10,000 requests/day
- Free tier sufficient
- Cost: $0/month

**Scenario 2: Medium deployment (1,000 learners)**
- ~100,000 requests/day
- ~3M requests/month
- Cost: $5/month (paid plan)

**Scenario 3: Large deployment (10,000 learners)**
- ~1M requests/day
- ~30M requests/month
- Cost: $5 + (20M × $0.50) = $15/month

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

**Note:** If using Cloudflare GitHub App, this workflow is optional.

### Set GitHub Secrets

1. Go to GitHub repo → Settings → Secrets
2. Add:
   - `CLOUDFLARE_API_TOKEN` - from Cloudflare dashboard
   - `CLOUDFLARE_ACCOUNT_ID` - your account ID

## Next Steps

After successful deployment:

1. **Integrate with AI Guide**
   - Add MCP server URL to AI configuration
   - Test all 3 tools from AI client
   - Monitor usage and performance

2. **Connect Real Database**
   - Replace mock data with SurrealDB/PostgreSQL
   - Implement data migration scripts
   - Test with real learner data

3. **Add Monitoring**
   - Set up error tracking (Sentry)
   - Configure alerts for errors
   - Track key metrics (latency, error rate)

4. **Scale & Optimize**
   - Implement caching strategies
   - Optimize database queries
   - Add rate limiting per learner

## Support

- **Cloudflare Docs:** https://developers.cloudflare.com/workers/
- **Wrangler CLI Docs:** https://developers.cloudflare.com/workers/wrangler/
- **MCP Protocol:** https://modelcontextprotocol.io/
- **Community:** Cloudflare Discord, GitHub Issues

---

**Last Updated:** 2025-02-05
**Version:** 2.0.0
