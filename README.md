# TETHER
<p align="center">
  <img src="./docs/brand/banner.svg" width="100%" alt="TETHER — Relationship State Engine" />
</p>

<p align="center"><strong>Part of the Tuzuminami AI Systems reference architecture.</strong><br />Independent packages, designed to compose — without claiming runtime package dependencies.</p>

> **System role:** Make relationship state explainable. TETHER models declared, bounded state without inferring real human emotion.

## Ecosystem reference architecture

The map below describes an **intended composition**, not current npm/package dependencies. Every repository remains independently usable and independently versioned. An application verifies a VEIL decision before it invokes RELAY; this does not indicate direct VEIL-to-RELAY SDK integration.

```mermaid
flowchart LR
  ASTER["ASTER<br/>Persona contracts"] -->|"compiled artifact reference"| DRIFT["DRIFT<br/>Scenarios & replay"]
  MORROW["MORROW<br/>Consent-aware memory"] --> APP["AI application"]
  TETHER["TETHER<br/>Relationship state"] --> APP
  APP -->|"action context"| VEIL["VEIL<br/>Policy decision"]
  APP -->|"model request after decision verification"| RELAY["RELAY<br/>Inference gateway"]
  RELAY --> PROVIDER["Model / tool provider"]
  PULSE["PULSE<br/>Evaluation harness"] -. "evaluates HTTP targets" .-> APP
  PULSE -.-> VEIL
  PULSE -.-> RELAY
  classDef policy fill:#1D2645,stroke:#6FF6C8,color:#FFFFFF
  classDef relationship fill:#3C144C,stroke:#E82973,color:#FFFFFF
  classDef gateway fill:#113A48,stroke:#31D2C9,color:#FFFFFF
  classDef eval fill:#3F215A,stroke:#E8A1FF,color:#FFFFFF
  classDef memory fill:#3D3A20,stroke:#EFD576,color:#FFFFFF
  classDef orchestration fill:#1D3942,stroke:#6DD9DF,color:#FFFFFF
  classDef persona fill:#3B1E14,stroke:#FFC79F,color:#FFFFFF
  class VEIL policy
  class TETHER relationship
  class RELAY gateway
  class PULSE eval
  class MORROW memory
  class DRIFT orchestration
  class ASTER persona
```

| System | What it contributes |
| --- | --- |
| [VEIL](https://github.com/tuzuminami/veil) | Fail-closed policy decisions and receipts before agent actions. |
| [TETHER](https://github.com/tuzuminami/tether) | Explicit, explainable relationship state. |
| [RELAY](https://github.com/tuzuminami/relay) | Tenant-aware inference routing and provider enforcement. |
| [PULSE](https://github.com/tuzuminami/pulse) | Regression evaluation for HTTP targets and release evidence. |
| [MORROW](https://github.com/tuzuminami/morrow) | Consent, purpose, retention, and revocation-aware memory. |
| [DRIFT](https://github.com/tuzuminami/drift) | Deterministic scenario/session orchestration and replay. |
| [ASTER](https://github.com/tuzuminami/aster) | Versioned persona contracts compiled into portable artifacts. |



TETHER is an explainable relationship state engine for AI products, games, education tools, community systems, and other conversational software.

It models relationship state as explicit versioned data: axes, bounded values, declared events, transition rules, boundary rules, deterministic decay, snapshots, and explanations. It does not infer real human emotions, diagnose users, optimize dependency, or mutate state from opaque model output.

## Current Capabilities

- Relationship model validation with axes, events, transition rules, boundary rules, and decay rules.
- Fail-closed rejection for undefined events, out-of-range declarations, and positive state progression from boundary-blocked events.
- Relationship creation pinned to a model version.
- Idempotent event application with stable conflict detection.
- Explainable snapshots with rule IDs, before/after state, event hashes, warnings, audit events, and outbox events.
- Tenant-scoped access checks and stable error codes.
- Minimal HTTP API with request/response envelopes.
- Public boundary guard to prevent private operator material from being committed.
- Strict TypeScript source, declaration output, and typecheck gate.
- PostgreSQL-backed HTTP runtime with transaction-backed idempotency, audit, and outbox writes.
- Checksummed PostgreSQL migration ledger protected by a transaction-scoped advisory lock.
- Explicit verified authentication adapter boundary; production startup fails closed without one.
- JSON Schema contract artifacts with fail-closed HTTP request validation.
- Non-mutating relationship event simulation API.
- Docker Compose development stack and E2E smoke script.

## Non-Goals

- No chat UI or companion application shell.
- No model inference or provider routing.
- No emotional scoring, attachment maximization, therapy, diagnosis, or claims of genuine feelings.
- No hidden prompt-only safety mechanism.

## Quick Start

```bash
npm run verify
npm run build
TETHER_RUNTIME_STORE=memory \
TETHER_BIND_HOST=127.0.0.1 \
TETHER_AUTH_ADAPTER=./your-verified-auth-adapter.mjs \
PORT=3000 \
node apps/api/server.mjs
```

Create a model:

```bash
curl -sS http://localhost:3000/v1/models \
  -H 'Authorization: Bearer <verified-credential>' \
  -H 'X-Tenant-Id: tenant_demo' \
  -H 'Content-Type: application/json' \
  --data @examples/relationship-model.json
```

Create a relationship:

```bash
curl -sS http://localhost:3000/v1/relationships \
  -H 'Authorization: Bearer <verified-credential>' \
  -H 'X-Tenant-Id: tenant_demo' \
  -H 'Content-Type: application/json' \
  --data '{"id":"rel_demo","modelId":"starter-model","modelVersion":"1.0.0","subjectRef":"subject_hash_demo"}'
```

Apply an event idempotently:

```bash
curl -sS http://localhost:3000/v1/relationships/rel_demo/events \
  -H 'Authorization: Bearer <verified-credential>' \
  -H 'X-Tenant-Id: tenant_demo' \
  -H 'Idempotency-Key: idem_demo_1' \
  -H 'Content-Type: application/json' \
  --data '{"id":"evt_demo_1","type":"helpful_interaction","payload":{"sourceRef":"message_hash_demo"}}'
```

Simulate an event without mutating state:

```bash
curl -sS http://localhost:3000/v1/relationships/rel_demo/simulate \
  -H 'Authorization: Bearer <verified-credential>' \
  -H 'X-Tenant-Id: tenant_demo' \
  -H 'Content-Type: application/json' \
  --data '{"event":{"id":"evt_sim_1","type":"helpful_interaction"}}'
```

## JavaScript Usage

```js
import {
  InMemoryRelationshipStore,
  RelationshipService
} from "@tuzuminami/tether";

const store = new InMemoryRelationshipStore();
const service = new RelationshipService(store);
const context = {
  tenantId: "tenant_demo",
  actorId: "actor_demo",
  scopes: ["model:write", "relationship:write", "relationship:read"],
  correlationId: "corr_demo"
};

service.createModel(context, {
  id: "starter-model",
  version: "1.0.0",
  axes: [{ id: "trust", min: 0, max: 100, initial: 50 }],
  events: [{ type: "helpful_interaction" }],
  transitionRules: [
    { id: "trust-helpful", eventType: "helpful_interaction", axis: "trust", delta: 8, reasonCode: "HELPFUL" }
  ],
  boundaryRules: [],
  decayRules: [{ axis: "trust", perDay: 2 }]
});
```

## PostgreSQL Persistence

Public `createTetherHttpServer()` and `handleTetherHttpRequest()` require an explicit authenticator. Tests inject an in-process authenticator; package consumers must configure a verified auth adapter. The packaged PostgreSQL runtime uses durable storage and transactional side effects:

```js
import { PostgresRelationshipStore } from "@tuzuminami/tether";

const store = PostgresRelationshipStore.fromConnectionString(process.env.DATABASE_URL);
await store.migrate();
```

`PostgresRelationshipStore` uses the same checked-out PostgreSQL client for each `BEGIN` / `COMMIT` / `ROLLBACK` block, and stores relationship updates, idempotency records, audit events, and outbox events in one transaction. Migrations take a transaction-scoped advisory lock and record an immutable version/checksum ledger; an unknown or changed applied migration stops startup. Call `await store.close()` during shutdown.

For a durable runtime, `TETHER_RUNTIME_STORE=postgres` requires `TETHER_MIGRATE_POSTGRES=1`, `DATABASE_URL`, and `TETHER_AUTH_ADAPTER`. The auth adapter is an ES module exporting `authenticateTetherRequest({ authorization, tenantId, correlationId })`, which must return a verified `{ tenantId, actorId, scopes, correlationId }` context. Adapters must throw `TetherAuthenticationError("invalid_credentials", ...)` for missing or invalid credentials (HTTP 401), and `TetherAuthenticationError("tenant_context_denied", ...)` for an authenticated identity that cannot use the requested tenant (HTTP 403). Any other adapter failure is an HTTP 503 dependency failure.

```bash
TETHER_RUNTIME_STORE=postgres \
TETHER_MIGRATE_POSTGRES=1 \
DATABASE_URL=postgres://tether:tether_dev_password@127.0.0.1:5432/tether \
TETHER_AUTH_ADAPTER=./dist/your-verified-auth-adapter.js \
TETHER_BIND_HOST=0.0.0.0 \
PORT=3000 \
node apps/api/server.mjs
```

`rollbackForDevelopment()` is provided for disposable local environments and tests. Production rollback should follow an expand/deploy/backfill/contract plan and restore from backups where destructive rollback would lose data.

## Docker Compose

```bash
docker compose up --build --wait
curl -fsS http://127.0.0.1:3000/ready
TETHER_BASE_URL=http://127.0.0.1:3000 \
TETHER_SMOKE_AUTHORIZATION='Bearer tether-compose-demo' \
npm run e2e:smoke
docker compose down
```

The Compose API and PostgreSQL ports bind only to loopback. It runs the durable PostgreSQL runtime and mounts a read-only demo auth adapter at startup; that adapter accepts only the documented smoke bearer token and is for local/CI smoke use, never production. Bare packaged server startup still fails closed until runtime storage, bind host, and a verified authentication adapter are configured explicitly.

The demo credential is tenant-fixed: it only accepts `X-Tenant-Id: tenant_smoke`. Any other tenant header is rejected, including with the otherwise valid demo bearer token.

## v1 to v2 migration

2.0.0 removes insecure HTTP runtime defaults. The `/v1` routes and JSON request
schemas remain stable, but startup and authentication must be made explicit.

### Removed APIs and configuration

- `createDefaultApiRuntime()` is no longer exported. Create a configured
  runtime with `createConfiguredApiRuntime()` instead.
- `createTetherHttpServer()` without an `authenticator` now throws.
- The built-in `Bearer dev-token` path and `TETHER_DEVELOPMENT_AUTH` are
  removed; `TETHER_DEVELOPMENT_AUTH` is rejected at startup.
- Implicit runtime store and bind-host defaults are removed. Set
  `TETHER_RUNTIME_STORE` and `TETHER_BIND_HOST` explicitly.

Replace a v1-style startup that relied on defaults:

```js
// v1: removed defaults and development token
createDefaultApiRuntime().server.listen(3000);
```

with an explicit v2 runtime:

```js
import { createConfiguredApiRuntime } from "@tuzuminami/tether";

const { config, server } = await createConfiguredApiRuntime();
server.listen(config.port, config.bindHost);
```

For PostgreSQL, set `TETHER_RUNTIME_STORE=postgres`, `DATABASE_URL`,
`TETHER_MIGRATE_POSTGRES=1`, `TETHER_BIND_HOST`, and `TETHER_AUTH_ADAPTER`.
Memory remains available only for deterministic development and test use.

### Auth adapter replacement

`TETHER_AUTH_ADAPTER` points to an ES module that exports
`authenticateTetherRequest`. Verify the credential in the adapter, then return
the exact tenant requested by `X-Tenant-Id`; do not trust a tenant supplied by
an unverified client claim. Import and throw `TetherAuthenticationError` for
expected denials; do not use an untyped `Error` for credential or tenant
decisions.

```js
// verified-auth-adapter.mjs
import { TetherAuthenticationError } from "@tuzuminami/tether";

export async function authenticateTetherRequest({ authorization, tenantId, correlationId }) {
  const identity = await verifyCredential(authorization); // application-owned verification
  if (identity === undefined) throw new TetherAuthenticationError("invalid_credentials", "Credential is invalid.");
  if (identity.tenantId !== tenantId) throw new TetherAuthenticationError("tenant_context_denied", "Tenant access is denied.");
  return { tenantId, actorId: identity.actorId, scopes: identity.scopes, correlationId };
}
```

### Rollback

Keep the v1 deployment artifact and a tested PostgreSQL backup until the v2
cutover is accepted. For production, prefer a forward fix or restore from the
backup rather than destructive schema rollback. `rollbackForDevelopment()` is
only for disposable local databases; it drops TETHER tables and must never be
used as a production rollback procedure.

### Probes

`GET /health` is liveness-only and does not contact PostgreSQL. `GET /ready`
performs a safe, read-only runtime readiness check; use it for load balancers,
Compose, and rollout gates that must confirm durable database availability.

## API Contract

See [openapi/openapi.yaml](openapi/openapi.yaml).

Protected endpoints require:

- A verified `Authorization` credential accepted by the configured auth adapter.
- `X-Tenant-Id`.
- `X-Correlation-Id` where available.
- `Idempotency-Key` for event application.

## Development

```bash
npm run check:private-boundary
npm run check:licenses
npm run typecheck
npm run build
npm test
npm run verify
npm run release:check
```

`npm test` exercises the HTTP handler in process, so it does not require a local listener. `npm run e2e:smoke` can target a live server by setting `TETHER_BASE_URL`.

## Security Model

Every HTTP runtime requires a separately supplied verified auth adapter, which returns the tenant-scoped actor and scopes used for authorization. Production mode also rejects memory runtime, skipped migration readiness checks, and missing adapters.

TETHER stores hashes and identifiers for event evidence in explanations; avoid sending raw conversation content as event payload. Use stable references or hashes from the caller system.

## Known Limitations

- `TETHER_RUNTIME_STORE=memory` remains a development/test runtime and is rejected in `NODE_ENV=production`.
- PostgreSQL migrations are forward-only in production; `rollbackForDevelopment()` is for disposable environments only.

## Operations

See [docs/OPERATIONS.md](docs/OPERATIONS.md) and [docs/RELEASE.md](docs/RELEASE.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
