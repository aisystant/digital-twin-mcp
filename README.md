# digital-twin-mcp

Autonomous MCP server for a learner's **digital twin** — a structured profile of
~65 indicators stored as a single JSONB document per user.

It serves the static indicator **metamodel** (4 categories: declarative, collected,
derived, generated) and reads/writes the authenticated user's profile data. Users may
only write to the `1_declarative` category; everything else is read-only for them.

Runs on Python (MCP Streamable HTTP) on Google Cloud Run, backed by Cloud SQL
PostgreSQL. See [INFRA.md](./INFRA.md) for infrastructure requirements.

## Auth

Every `tools/call` requires a valid Ory JWT (Hydra JWKS, RS256). Identity is the `sub`
claim; there is no `x-user-id` fallback. Subscription is read from a JWT claim. Each
caller only ever sees their own twin.

## Tools

| Tool | Purpose |
|------|---------|
| `describe_by_path` | Navigate the indicator metamodel (categories → subgroups → indicators) at a given path. |
| `read_digital_twin` | Read a value from the caller's twin by path (dot/slash notation; `/` = whole document). |
| `write_digital_twin` | Write a value to the caller's twin by path. Only the `1_declarative` category is user-writable. |

### Not ported (legacy `dt_*`)

Four `dt_*` tools from the legacy stdio build are **not** ported. Default stance: if a
tool's need isn't obvious, it is dropped and the question is logged in
`../OPEN-QUESTIONS.md` — re-added only if proven necessary.

- `dt_update_profile_rcs`, `dt_snapshot_rcs` — write `3_derived`, which is the R28
  Profiler service's responsibility (DP.ARCH.003), not a user tool.
- `dt_get_profile_rcs` — redundant with `read_digital_twin("3_derived/rcs_profile")`.
- `dt_get_cp_profile` — read from `learning.cp_assessments`; need not obvious and it
  pulls in the `learning` DB dependency. Dropped pending discussion.

## Tests as contract

There is no separate contract document. The tool list above is the promise; the tests
under `tests/` are the executable specification (I/O shape, auth gating, write
access-control, cross-user isolation). The implementation must pass them.
