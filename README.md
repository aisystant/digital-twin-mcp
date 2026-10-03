# Digital Twin MCP Server

> **Тип репозитория:** `DS/instrument`

MCP (Model Context Protocol) server for Digital Twin learner data. Provides tools for AI Guide (Проводник) to work with learner profiles based on 4-type indicator classification.

## Overview

This server implements a metamodel-driven approach with 3 shared MCP tools, 4 local extensions and 4 indicator types (IND.1-4).

### Key Features

- **3 shared MCP tools + 4 stdio extensions** for metamodel exploration and data management
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
│  - 3 core + 4 stdio extensions     │
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

### Write path security

Both transports normalize dot/slash paths before checking user access. User writes
are limited to `1_declarative`; nested declarative keys remain extensible. Empty
paths, unknown categories, empty internal segments, backslashes, control characters,
and `__proto__`, `prototype`, or `constructor` segments are rejected before storage
access. Root reads (`""`, `/`, `.`) remain supported. Local system RCS updates use
their separate, fixed `3_derived` paths.

### Release readiness

Use the shared [Twelve-Factor/MCP acceptance standard](https://github.com/aisystant/DS-ecosystem-development/blob/main/C.IT-Platform/C2.IT-Platform/C2.3.Operations/README.md).
From the `DS-ecosystem-development` checkout, verify readiness evidence for the
exact revision and deployment:

```bash
python3 0.OPS/scripts/platform-services-registry.py --readiness digital-twin-mcp --revision <full-commit-sha> --deployment cloudflare:production
```

This checks recorded evidence for that revision/environment; it does not inspect
configuration automatically or replace the full standard review. Assess local
deployments separately with their own deployment identifier and evidence: local
results do not establish cloud readiness, or vice versa.

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

**Version:** see `package.json` (shared by both transports)
**Last Updated:** 2026-10-03

## Concurrent writes and content revisions

The shared catalog is `src/tool-catalog.js`: HTTP exposes three core tools; stdio
also exposes `dt_get_profile_rcs`, `dt_update_profile_rcs`, `dt_snapshot_rcs`, and
`dt_get_cp_profile`. All transports report the release version from `package.json`.
This does not make all transport behavior identical: HTTP continues to parse a
JSON-encoded string passed as `data`; stdio stores it as a literal string.

Writes require an explicit `data` value (including `null` when intended).
Within arrays, paths accept only canonical non-negative integer indices: an
existing index or exactly the next index for contiguous append. Named properties,
leading zeros and sparse indices are rejected. Replacing an entire array remains
supported.

Existing reads return the same value as before, including root reads. Opt in to a
content revision when an update depends on previously read data:

```json
{"path":"1_declarative","include_revision":true}
```

The result is `{ "data": ..., "revision": "v1:<64 hex characters>" }`. Pass that
revision as `expected_revision` to `write_digital_twin` or either local RCS writer.
A stale revision returns `revision_conflict` without applying or retrying the
mutation. Successful writes include the new `revision`. Revisions describe the
whole document's current contents, not an event sequence: A→B→A is permitted.
An absent database row differs from an existing empty document. File formatting
changes may invalidate a revision even when JSON values are equivalent.

Without `expected_revision`, PostgreSQL attempts at most three read/mutate/CAS
cycles. Every retry applies only the requested path operation to the latest
snapshot. Independent changes survive; the last successful write to the same
path wins. CAS compares the original JSONB, so it also detects external SQL
updates of `data` without a migration or revision column. A change to only
`updated_at` does not conflict. Network errors are not retried because the commit
outcome may be unknown. This does not make repeated client requests idempotent
or protect external writers that replace whole documents or stale subtrees.

Local Neon uses `INDICATORS_DB_SCHEMA` (default `indicators`); HTTP retains its
existing unqualified `digital_twins`/database search path. These may be different
physical stores. This release neither moves data nor unifies their connections.
Missing cloud database configuration returns `storage_unavailable`, never a
successful unpersisted write.

The local file backend retains the plain `data/twin.json` format. Cooperating
processes lock its resolved path through the whole read/update cycle, write a
private temporary file, sync it, atomically rename it, and sync the directory.
A lock timeout returns `storage_locked`; locks are never stolen by age. After a
crash, stop all processes using that file, establish that its owner has exited,
and only then remove the adjacent `.lock`. A replaced lock is not removed by its
former owner. `storage_outcome_unknown` after rename requires re-reading before
retrying. Direct file writers that ignore this locking protocol are outside its
guarantee. Use a local filesystem, not a network filesystem.

### Development verification

Install the committed dependency snapshot with `npm ci`. Use Node.js 22+ and PostgreSQL 16+ command-line tools (`psql`, `initdb`, `pg_ctl`)
on `PATH`. `npm test` creates and removes its own temporary PostgreSQL cluster
and synthetic twin files; it never loads `data/twin.json` from your working copy.
Alternatively, set `DT_TEST_POSTGRES_URL` to a disposable local database named
`dt_cas_test`. CI supplies that database in a PostgreSQL service container.
Tests exercise the installed Neon SDK against real PostgreSQL statements,
concurrent Node processes, authenticated HTTP and stdio contracts, and workerd
through Miniflare. The local Neon HTTP test adapter is not a production Neon
network/connectivity test.

Run `npm run build` after changing metamodel Markdown, then
`npm run check:metamodel`. CI rejects stale generated content before testing or
publishing. The generator is deterministic; it does not embed build timestamps.
