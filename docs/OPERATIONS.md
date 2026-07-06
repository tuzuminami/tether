# TETHER Operations

## Runtime Modes

- Development API: `npm run build && TETHER_RUNTIME_STORE=memory npm start`
- Local smoke: `npm run verify`
- Docker stack: `docker compose up --build`

The packaged HTTP API runtime uses in-memory state for deterministic development. Runtime storage is explicit:

- `TETHER_RUNTIME_STORE=memory`: supported v0.2 HTTP runtime.
- `TETHER_RUNTIME_STORE=postgres`: intentionally fails closed until the HTTP `RelationshipService` is wired to a durable store.

Server startup fails closed when `TETHER_RUNTIME_STORE` is missing. Do not treat successful PostgreSQL migration as proof that the HTTP runtime is durable. Production deployments should wire a durable store explicitly and replace the development bearer-token adapter.

## PostgreSQL Migrations

`PostgresRelationshipStore.migrate()` applies the v0.2 schema idempotently inside one transaction. `rollbackForDevelopment()` drops TETHER tables and indexes inside one transaction for disposable local environments only.

Set `TETHER_MIGRATE_POSTGRES=1` with `DATABASE_URL` to run migrations during packaged server startup. This does not change the HTTP runtime store; set `TETHER_RUNTIME_STORE=memory` explicitly until durable HTTP storage is implemented.

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
