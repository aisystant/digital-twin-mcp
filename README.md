# Digital Twin MCP Server

> **Тип репозитория:** `DS/instrument`

MCP (Model Context Protocol) server for Digital Twin learner data. Provides tools for AI Guide (Проводник) to work with learner profiles based on 4-type indicator classification.

## Overview

This server implements a metamodel-driven approach with 3 MCP tools and 4 indicator types (IND.1-4).

### Key Features

- **3 MCP Tools** for metamodel exploration and data management
- **4-Type Classification** (IND.1-4) with access control
- **65+ Indicators** organized in hierarchical structure
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
│  - 3 tools                          │
│  - Access control (IND.1 writable)  │
│  - Metamodel-driven                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Data Store                         │
│  - Metamodel (MD files)             │
│  - Twin data (PostgreSQL/Neon)      │
│  - OAuth state (Cloudflare KV)      │
└─────────────────────────────────────┘
```

## Available Tools

| Tool | Description |
|------|-------------|
| `describe_by_path` | Navigate metamodel structure. List categories, groups, indicators |
| `read_digital_twin` | Read data from digital twin by path |
| `write_digital_twin` | Write data to digital twin (1_declarative only for users) |

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account (for deployment)
- Neon PostgreSQL database (for persistent twin data storage)

### Install Dependencies

```bash
npm install
```

## Usage

### Option 1: Local MCP Server (stdio)

For use with MCP clients like Claude Desktop:

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

# Describe metamodel root
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "describe_by_path",
    "arguments": {"path": "/"}
  }'
```

#### Deploy to Cloudflare

Uses Cloudflare GitHub App for automatic deployment on push to main.

Set secrets before first deploy:

```bash
npx wrangler secret put ORY_CLIENT_SECRET --env ory-auth
npx wrangler secret put DATABASE_URL --env ory-auth
```

Manual deployment:

```bash
npm run deploy -- --env ory-auth
```

## API Examples

### Explore Metamodel

```bash
# List all categories
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{"tool": "describe_by_path", "arguments": {"path": "/"}}'

# List subgroups in 1_declarative
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{"tool": "describe_by_path", "arguments": {"path": "1_declarative"}}'

# List indicators in goals subgroup
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{"tool": "describe_by_path", "arguments": {"path": "1_declarative/1_2_goals"}}'

# Read specific indicator definition
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{"tool": "describe_by_path", "arguments": {"path": "1_declarative/1_2_goals/09_Цели обучения"}}'
```

### Read Twin Data

```bash
# Read all data
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{"tool": "read_digital_twin", "arguments": {"path": "/"}}'

# Read specific path
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{"tool": "read_digital_twin", "arguments": {"path": "indicators.agency"}}'
```

### Write Twin Data

```bash
# Write to 1_declarative (allowed)
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "write_digital_twin",
    "arguments": {
      "path": "1_declarative/goals/learning",
      "data": ["Learn TypeScript", "Master MCP"]
    }
  }'

# Write to 2_collected (denied for users)
curl -X POST http://localhost:8787/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "write_digital_twin",
    "arguments": {
      "path": "2_collected/time/total",
      "data": 100
    }
  }'
# Returns: {"error": "Access denied: users cannot write to 2_collected"}
```

## Testing

Run tests:

```bash
npm test
```

Test stdio server directly:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node src/index.js
```

## Development

### Project Structure

```
digital-twin-mcp/
├── src/
│   ├── index.js              # MCP server (stdio, file-based storage)
│   ├── worker-sse.js         # Cloudflare Worker (PostgreSQL/Neon storage)
│   └── metamodel-data.js     # Generated metamodel data
├── metamodel/                # MD files defining indicators
├── data/
│   └── twin.json             # Twin data store (stdio mode only)
├── scripts/
│   └── build-metamodel.js    # Regenerate metamodel-data.js
├── package.json
├── wrangler.toml             # Cloudflare config
└── README.md
```

### Adding New Indicators

1. Determine type (IND.1-4)
2. Place MD file in correct category/subgroup folder
3. Use format: `NN_Name.md`
4. Include required metadata:
   ```markdown
   # IND.X.Y.Z

   **Name:** Indicator name
   **Name (EN):** English name
   **Type:** semantic|temporal|categorical
   **Format:** string|float|enum|structured_text
   ```
5. Regenerate data: `node scripts/build-metamodel.js`
6. Run tests: `npm test`

## Related Documentation

- [ABOUT.md](./ABOUT.md) - Positioning in knowledge architecture, specifications, indicator classification, metamodel structure
- [MAPSTRATEGIC.md](./MAPSTRATEGIC.md) - Strategic vision (phases, versions)
- [WORKPLAN.md](./WORKPLAN.md) - Operational plan (work products, deadlines)
- [QUICKSTART.md](./QUICKSTART.md) - Quick deployment guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Full deployment guide
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

## License

MIT

---

**Version:** 2.0.0
**Last Updated:** 2025-02-05
