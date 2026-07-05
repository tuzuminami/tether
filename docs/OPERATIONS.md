# TETHER Operations

## Runtime Modes

- Development API: `npm run build && npm start`
- Local smoke: `npm run verify`
- Docker stack: `docker compose up --build`

The default HTTP API runtime uses in-memory state for deterministic development. Production deployments should wire a durable store explicitly and replace the development bearer-token adapter.

## PostgreSQL Migrations

`PostgresRelationshipStore.migrate()` applies the v0.2 schema idempotently. `rollbackForDevelopment()` drops TETHER tables and indexes for disposable local environments only.

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
