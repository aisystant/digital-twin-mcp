# Digital Twin MCP deployment

This guide describes the deployment configured in this repository. The source of truth is `wrangler.toml`, `.github/workflows/deploy.yml`, and `src/worker-sse.js`.

## Prerequisites

- Node.js 22 or newer and npm (`package.json` declares `node >=22.0.0`).
- Cloudflare access for a manual deployment. The GitHub Actions deployment uses its configured `CLOUDFLARE_API_TOKEN` secret.
- PostgreSQL 16 for the local database tests. CI provides a disposable PostgreSQL service; locally the tests start one using `initdb` and `pg_ctl` unless `DT_TEST_POSTGRES_URL` points to a disposable loopback database named `dt_cas_test`.

From the repository root, install the locked dependencies and run the checks:

```bash
npm ci
npm run check:metamodel
npm test
```

## Current Worker configuration

`wrangler.toml` names the Worker `digital-twin-mcp`, uses `src/worker-sse.js` as its entrypoint, and routes `twin.aisystant.com/*` to it. The Worker also has a `workers.dev` address. The configured environment is the default environment; there are no `[env.staging]` or `[env.production]` sections.

`ORY_URL` and `DATABASE_URL` are Worker secrets. The Worker verifies bearer JWTs against Ory JWKS and stores twin data in PostgreSQL. Keep the database URL out of logs and documentation. `GET /health`, `GET /mcp`, and MCP `tools/list` are public; all other MCP methods require a valid bearer token. The Gateway checks subscription access before forwarding authenticated calls to this backend.

## Local development

```bash
npm run dev
```

Wrangler normally listens at `http://localhost:8787`. These read-only requests exercise the current endpoints:

```bash
curl http://localhost:8787/health
curl http://localhost:8787/mcp
curl -X POST http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The local Worker needs its own development bindings for authenticated reads and writes. Do not point a development Worker at the production database for acceptance tests.

## Deployment

A push to `main` runs `.github/workflows/deploy.yml`: it installs dependencies, checks the generated metamodel, runs the security, PostgreSQL CAS, file-concurrency and Workers-runtime tests, then deploys with `cloudflare/wrangler-action@v3`. Pull requests run the checks but skip deployment.

For an authorized manual deployment from this repository, use the default Wrangler environment:

```bash
npm run deploy
```

This runs the metamodel build and `wrangler deploy`. It targets the configured `digital-twin-mcp` Worker and route. There is no working `--env staging` or `--env production` command in the current configuration. A separate staging Worker would need its own route, Ory configuration, and isolated database before it could be used for write acceptance.

## Read-only production verification

```bash
curl https://twin.aisystant.com/health
curl https://twin.aisystant.com/mcp
curl -X POST https://twin.aisystant.com/mcp \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

`/health` reports service status and version. `GET /mcp` reports version, storage availability and tool names. `tools/list` returns the live tool schemas. These responses do not prove write behavior or expose the deployed source revision. For an exact release, also check the successful GitHub Actions run and its Cloudflare Deploy step for the merge commit. Authenticated write acceptance requires an isolated test identity and database with a cleanup plan; do not use a personal twin for synthetic writes.

## Logs and troubleshooting

```bash
npx wrangler tail
```

Run this against the default configured Worker; `--env production` is not configured. For failed deployments, inspect the relevant GitHub Actions run and verify the Worker secrets are configured without printing their values. For unexpected MCP responses, confirm the request uses `/mcp` and JSON-RPC `tools/list` or `tools/call`; the old `/tools` and `/call` endpoints are not implemented by `src/worker-sse.js`.
