# Ory Authentication Setup

## 1. Create OAuth Application in Ory

### Ory Cloud Enterprise
1. Go to [Ory Console](https://console.ory.sh/)
2. Select your project
3. Navigate to **OAuth2 Clients** → **Create Client**

### Ory Self-Hosted
```bash
ory create oauth2-client \
  --endpoint https://your-ory-instance.com \
  --name "Digital Twin MCP Server" \
  --grant-type authorization_code,refresh_token \
  --response-type code \
  --scope openid,offline_access \
  --token-endpoint-auth-method client_secret_post \
  --redirect-uri "your-mcp-client-redirect-uri"
```

## 2. OAuth Application Configuration

```yaml
Name: Digital Twin MCP Server
Grant Types: authorization_code, refresh_token
Response Types: code
Scopes: openid, offline_access
Token Endpoint Auth Method: client_secret_post
Redirect URIs: (depends on your MCP client)
```

**Note:** For MCP clients like Claude Desktop, check client documentation for redirect URI format.

## 3. Configure Email + OTP Authentication

### Ory Cloud
1. Go to **Authentication** → **Methods**
2. Enable **Email + Code (OTP)**
3. Configure email settings (SMTP or Ory's default email service)

### Ory Self-Hosted
Edit your Ory Kratos config:
```yaml
selfservice:
  methods:
    code:
      enabled: true
      config:
        lifespan: 15m
```

## 4. Environment Variables

After creating the OAuth app, save these values:

```bash
# Required
ORY_ISSUER_URL=https://your-project.projects.oryapis.com
ORY_CLIENT_ID=your-client-id-from-ory
ORY_CLIENT_SECRET=your-client-secret-from-ory

# Optional (if you configured audience in Ory)
ORY_AUDIENCE=your-api-audience
```

### Get Issuer URL

**Ory Cloud:**
```
https://{project-slug}.projects.oryapis.com
```

**Ory Self-Hosted:**
```
https://your-ory-domain.com
```

## 5. Deploy to Cloudflare Workers

### Set Secrets
```bash
# Required secrets
wrangler secret put ORY_ISSUER_URL
# Enter: https://your-project.projects.oryapis.com

wrangler secret put ORY_CLIENT_ID
# Enter: your-client-id

wrangler secret put ORY_CLIENT_SECRET
# Enter: your-client-secret

# Optional
wrangler secret put ORY_AUDIENCE
# Enter: your-api-audience (if configured)
```

### Deploy
```bash
npm run deploy
```

## 6. Local Development

### Without Authentication (Development Mode)
```bash
# Don't set ORY_ISSUER_URL
npm run dev
```

### With Authentication
```bash
# Create .env file (see .env.example)
cp .env.example .env

# Edit .env with your Ory values
nano .env

# Run with wrangler (uses .dev.vars)
npm run dev
```

## 7. Create Users in Ory

### Ory Cloud
1. Go to **Identity Management** → **Create Identity**
2. Add email and verify

### Ory Self-Hosted
```bash
ory create identity \
  --endpoint https://your-ory-instance.com \
  --schema person \
  --trait email="user@example.com"
```

## 8. MCP Client Configuration

### Claude Desktop (Example)
```json
{
  "mcpServers": {
    "digital-twin": {
      "url": "https://your-worker.workers.dev/mcp",
      "oauth": {
        "authorizationUrl": "https://your-project.projects.oryapis.com/oauth2/auth",
        "tokenUrl": "https://your-project.projects.oryapis.com/oauth2/token",
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret",
        "scopes": ["openid", "offline_access"]
      }
    }
  }
}
```

## 9. Testing

### Test Authentication
```bash
# Get access token from Ory
curl -X POST https://your-project.projects.oryapis.com/oauth2/token \
  -d "grant_type=client_credentials" \
  -d "client_id=your-client-id" \
  -d "client_secret=your-client-secret" \
  -d "scope=openid"

# Test MCP endpoint with token
curl -X POST https://your-worker.workers.dev/mcp \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

## 10. Migration: Cloud → Self-Hosted

The implementation is Ory-version-agnostic. Simply update environment variables:

```bash
# Update issuer URL to your self-hosted instance
wrangler secret put ORY_ISSUER_URL
# Enter: https://your-self-hosted-ory.com

# No code changes needed
npm run deploy
```

## Troubleshooting

### "Invalid token" error
- Check token expiration
- Verify `ORY_ISSUER_URL` matches token issuer
- Ensure JWKS endpoint is accessible: `{ORY_ISSUER_URL}/.well-known/jwks.json`

### "Missing Authorization header"
- Add `Authorization: Bearer {token}` header to requests
- Check CORS settings allow Authorization header

### Token validation slow
- JWKS keys are cached for 1 hour
- First request fetches keys (slower)
- Subsequent requests use cached keys (faster)
