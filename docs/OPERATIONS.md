# TETHER Operations

<!-- tether-release-status: source=v2.0.0; github=v1.0.0; npm=unpublished; v2=unreleased -->

This document describes the unreleased v2.0.0 source deployment contract. The latest
published GitHub release is v1.0.0, so do not present these settings as a published v2
runtime until the v2 tag and release exist. Retain the migration guidance in the README
and release checklist when upgrading from v1.

## Runtime Modes

- Development API: `npm run build && TETHER_RUNTIME_STORE=memory TETHER_BIND_HOST=127.0.0.1 TETHER_AUTH_ADAPTER=./your-verified-auth-adapter.mjs npm start`
- Local smoke: `npm run verify`
- Docker smoke: `docker compose up --build --wait && curl -fsS http://127.0.0.1:3000/ready && TETHER_BASE_URL=http://127.0.0.1:3000 TETHER_SMOKE_AUTHORIZATION='Bearer tether-compose-demo' npm run e2e:smoke && docker compose down`

The packaged HTTP API runtime uses in-memory state for deterministic development and PostgreSQL for durable deployments. Runtime storage is explicit:

- `TETHER_RUNTIME_STORE=memory`: deterministic development runtime.
- `TETHER_RUNTIME_STORE=postgres`: durable runtime; requires `DATABASE_URL`, `TETHER_MIGRATE_POSTGRES=1`, and `TETHER_AUTH_ADAPTER`.

Server startup fails closed when `TETHER_RUNTIME_STORE`, `TETHER_BIND_HOST`, or `TETHER_AUTH_ADAPTER` is missing. In `NODE_ENV=production`, memory runtime, skipped migration readiness, and a missing auth adapter are rejected. The auth adapter is an ES module exporting `authenticateTetherRequest({ authorization, tenantId, correlationId })`; it must return a verified tenant-scoped request context.

The Compose demo adapter is local/CI-only and tenant-fixed to `tenant_smoke`: `Bearer tether-compose-demo` with any other `X-Tenant-Id` fails authentication. `docker compose up --wait` waits for both the PostgreSQL and API healthchecks; the API healthcheck uses `GET /ready`.

`GET /health` is a public liveness probe and never contacts PostgreSQL. `GET /ready` is a public readiness probe: the PostgreSQL runtime performs a safe `SELECT 1`, and returns `503 DEPENDENCY_UNAVAILABLE` if its durable dependency cannot serve requests. Use `/ready` for traffic admission and rollout gates.

## PostgreSQL Migrations

`PostgresRelationshipStore.migrate()` obtains a transaction-scoped PostgreSQL advisory lock, validates the `tether_schema_migrations` version/checksum ledger, then applies only missing migrations and records their checksums in the same transaction. `TETHER_POSTGRES_MIGRATIONS` remains the public DDL `string[]`; `TETHER_POSTGRES_MIGRATION_METADATA` exposes version/checksum metadata for callers that need it. A legacy schema is baselined only after its table/column types, nullability, deterministic `C` collation for tenant and identity text, primary keys, required indexes, and defaults match the initial migration. Unknown or checksum-changed applied migrations fail closed. `rollbackForDevelopment()` drops TETHER tables and indexes inside one transaction for disposable local environments only.

Set `TETHER_MIGRATE_POSTGRES=1` with `DATABASE_URL` to run migration readiness checks during packaged server startup. PostgreSQL HTTP runtime retains its pool for the process lifetime; close it during graceful shutdown.

Production rollback guidance:

- Prefer forward fixes for already-applied schema changes.
- Back up PostgreSQL before migration jobs.
- Use expand/deploy/backfill/contract for incompatible schema changes.
- Do not run destructive rollback against production data unless restore and data-loss impact are explicitly approved.

## Data Protection

- Send stable references or hashes in event payloads instead of raw conversation text.
- Do not put secrets, tokens, direct identifiers, or private operator material in fixtures, logs, or payload examples.
- Keep tenant identifiers in every storage query and API request context.

## Incident Triage

For authentication, tenant boundary, migration, or storage incidents:

1. Capture `X-Correlation-Id`, request route, tenant id, and actor id.
2. Check audit and outbox rows for the affected resource id.
3. Stop processing if policy, auth, or tenant context is ambiguous.
4. Prefer replaying idempotent requests with the same key over ad hoc repair writes.
