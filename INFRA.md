# Infrastructure Requirements — digital-twin-mcp (Python / Google Cloud)

Specification for the infrastructure/DB admin. This server is an **autonomous MCP
server**: it authenticates every request itself and can be used directly, with or
without the aggregating Gateway in front of it.

Compared to the other two servers, digital-twin-mcp is the **simplest**: a single
JSONB document per user, **no vector search, no queue, no cron, no object storage**.

## 1. Compute

- **Cloud Run** service (1 service), HTTP, stateless, scale-to-zero allowed.
- Listens on `$PORT` (Cloud Run convention). Transport: MCP Streamable HTTP.
- Concurrency: default is fine; no in-memory session affinity required beyond what
  the MCP transport itself needs (keep MCP sessions sticky if streaming is enabled —
  prefer `min-instances >= 1` only if cold-start latency matters).
- CPU/memory: minimal (no embeddings, no heavy deps). Start at 0.5 vCPU / 256–512 MB.

## 2. Database — Cloud SQL for PostgreSQL

- **PostgreSQL 16** (or current LTS), single instance.
- **No extensions required** (no `pgvector`, no `pg_trgm`). Core JSONB is enough.
- Connectivity from Cloud Run via **Cloud SQL Auth Proxy / private IP connector**
  (no public IP).

### 2.1 Owned schema/table

```sql
CREATE TABLE digital_twins (
  user_id    TEXT PRIMARY KEY,           -- Ory identity subject (sub claim)
  data       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> NOTE — schema decision required: the legacy TS code is inconsistent — the stdio
> build wrote to `indicators.digital_twins` while the Worker wrote to bare
> `digital_twins`. For the Python version we standardize on **one** name. Default
> proposed: `public.digital_twins`. Admin to confirm the schema name; it is wired
> via env (see §4), not hardcoded.

### 2.2 Foreign read — learner CP assessments (DROPPED by default)

> The only consumer of this was `dt_get_cp_profile`, which is **not ported** (see
> README and `../OPEN-QUESTIONS.md`). So the `learning` DB dependency and
> `LEARNING_DATABASE_URL` are **not required**. The section below applies only if that
> tool is later proven necessary and re-added.

It reads the latest row from:

```
learning.cp_assessments  (account_id uuid, stage, bottleneck_slot,
                          recommended_stream, skip_to_stage, cp_scores,
                          assessed_at, valid_until, ...)
```

Requirements if this tool is kept:
- The `learning` schema may live in the **same** Cloud SQL instance (preferred) or a
  separate one. The connection is configured independently (env `LEARNING_DATABASE_URL`,
  falling back to the main `DATABASE_URL`).
- The app DB role needs **SELECT only** on `learning.cp_assessments`.
- `account_id` is a `uuid`; the server passes the JWT `sub` cast to uuid. Confirm that
  Ory `sub` values are valid UUIDs in this deployment, otherwise the cast fails.

### 2.3 Roles / grants

One application role (least privilege):
- `SELECT, INSERT, UPDATE` on `digital_twins`.
- `SELECT` on `learning.cp_assessments` (only if §2.2 is kept).
- No `DELETE`, no DDL at runtime (migrations run as a separate migration role).

### 2.4 Row-level isolation (recommended)

Isolation today is application-level only (`WHERE user_id = <sub>`). Recommended
defense-in-depth: enable **Postgres RLS** on `digital_twins`, policy keyed on a
per-transaction setting (`current_setting('app.user_id')`), and have the app set it
via `SET LOCAL` inside each request transaction. Admin to decide whether RLS is
enforced at the DB level or left to the application layer. (This mirrors the approach
the knowledge servers will need; keeping it consistent across the three is desirable.)

## 3. Schema migrations

- Managed via a migration tool run on deploy (e.g. Alembic or plain SQL files), as a
  dedicated migration DB role with DDL rights. Runtime role has no DDL.
- The metamodel (~65 indicators, the directory tree under `metamodel/`) is **static
  content**, not DB data. In Python it ships with the service (read from packaged
  files at startup) — no build step, no DB table for it.

## 4. Secrets & configuration (Secret Manager + env)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `DATABASE_URL` | secret | yes | Cloud SQL connection string for `digital_twins` |
| `ORY_URL` | config/secret | yes | Ory Hydra base URL; JWKS fetched from `${ORY_URL}/.well-known/jwks.json` |
| `KNOWLEDGE_DB_SCHEMA` / `DIGITAL_TWIN_DB_SCHEMA` | config | yes | schema name for `digital_twins` (default `public`) |
| `LEARNING_DATABASE_URL` | secret | no | only if `dt_get_cp_profile` is kept; falls back to `DATABASE_URL` |
| `CORS_ORIGIN` | config | no | CORS allow-origin; default `*` (do not send `Allow-Credentials` when `*`) |

- **Do NOT log connection strings** (the TS version logged the first 15 chars of
  `DATABASE_URL` — must not be carried over).

## 5. Network egress

- To **Ory Hydra** (`ORY_URL`) for JWKS — HTTPS, outbound. JWKS is cached in-process.
- To **Cloud SQL** via the connector (private).
- No other outbound dependencies (no OpenAI/OpenRouter, no GitHub).

## 6. Not needed for this server (explicitly)

- ❌ `pgvector` / embeddings / any LLM provider
- ❌ Queue (Postgres or otherwise)
- ❌ Cron / scheduled jobs
- ❌ Object storage / buckets
- ❌ GitHub App credentials

## 7. Observability

- Cloud Logging via stdout/stderr. Structured logs preferred.
- Health endpoint for Cloud Run startup/liveness probes (see CONTRACT).
- Metrics: request count / latency / auth-failure count are enough; no custom metrics DB.
