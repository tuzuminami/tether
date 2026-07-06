# TETHER

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
- PostgreSQL persistence adapter with migrations and transaction-backed idempotency, audit, and outbox writes.
- Explicit HTTP runtime store configuration that fails closed if unsupported durable runtime storage is requested.
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
TETHER_RUNTIME_STORE=memory PORT=3000 node apps/api/server.mjs
```

Create a model:

```bash
curl -sS http://localhost:3000/v1/models \
  -H 'Authorization: Bearer dev-token' \
  -H 'X-Tenant-Id: tenant_demo' \
  -H 'Content-Type: application/json' \
  --data @examples/relationship-model.json
```

Create a relationship:

```bash
curl -sS http://localhost:3000/v1/relationships \
  -H 'Authorization: Bearer dev-token' \
  -H 'X-Tenant-Id: tenant_demo' \
  -H 'Content-Type: application/json' \
  --data '{"id":"rel_demo","modelId":"starter-model","modelVersion":"1.0.0","subjectRef":"subject_hash_demo"}'
```

Apply an event idempotently:

```bash
curl -sS http://localhost:3000/v1/relationships/rel_demo/events \
  -H 'Authorization: Bearer dev-token' \
  -H 'X-Tenant-Id: tenant_demo' \
  -H 'Idempotency-Key: idem_demo_1' \
  -H 'Content-Type: application/json' \
  --data '{"id":"evt_demo_1","type":"helpful_interaction","payload":{"sourceRef":"message_hash_demo"}}'
```

Simulate an event without mutating state:

```bash
curl -sS http://localhost:3000/v1/relationships/rel_demo/simulate \
  -H 'Authorization: Bearer dev-token' \
  -H 'X-Tenant-Id: tenant_demo' \
  -H 'Content-Type: application/json' \
  --data '{"event":{"id":"evt_sim_1","type":"helpful_interaction"}}'
```

## JavaScript Usage

```js
import {
  InMemoryRelationshipStore,
  RelationshipService,
  createDevelopmentContext
} from "@tuzuminami/tether";

const store = new InMemoryRelationshipStore();
const service = new RelationshipService(store);
const context = createDevelopmentContext({ tenantId: "tenant_demo" });

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

The default development runtime uses `InMemoryRelationshipStore` so local tests stay deterministic. Production services can use the PostgreSQL adapter API for durable persistence and transactional side effects:

```js
import { PostgresRelationshipStore } from "@tuzuminami/tether";

const store = PostgresRelationshipStore.fromConnectionString(process.env.DATABASE_URL);
await store.migrate();
```

`PostgresRelationshipStore` uses the same checked-out PostgreSQL client for each `BEGIN` / `COMMIT` / `ROLLBACK` block, and stores relationship updates, idempotency records, audit events, and outbox events in one transaction. Call `await store.close()` during shutdown.

The packaged HTTP server does not silently pretend to be durable. `TETHER_RUNTIME_STORE=memory` is the supported server runtime for v0.2. `TETHER_RUNTIME_STORE=postgres` intentionally aborts startup until the HTTP `RelationshipService` is wired to a durable store. `TETHER_MIGRATE_POSTGRES=1` may be used to apply PostgreSQL migrations before starting the memory runtime in disposable development stacks:

```bash
TETHER_RUNTIME_STORE=memory \
TETHER_MIGRATE_POSTGRES=1 \
DATABASE_URL=postgres://tether:tether_dev_password@127.0.0.1:5432/tether \
PORT=3000 \
node apps/api/server.mjs
```

`rollbackForDevelopment()` is provided for disposable local environments and tests. Production rollback should follow an expand/deploy/backfill/contract plan and restore from backups where destructive rollback would lose data.

## Docker Compose

```bash
docker compose up --build
TETHER_BASE_URL=http://127.0.0.1:3000 npm run e2e:smoke
```

The compose stack starts PostgreSQL and the API with `TETHER_RUNTIME_STORE=memory`. The API applies PostgreSQL migrations when `TETHER_MIGRATE_POSTGRES=1`; the HTTP runtime remains in-memory for deterministic local development. Bare packaged server startup fails closed until `TETHER_RUNTIME_STORE` is set explicitly.

## API Contract

See [openapi/openapi.yaml](openapi/openapi.yaml).

Protected endpoints require:

- `Authorization: Bearer dev-token` for the development adapter only.
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

The current development adapter is intentionally narrow and rejects missing or invalid bearer credentials. Production auth is not implemented in v0.2. Production deployments must replace the development bearer-token adapter before exposing the API.

TETHER stores hashes and identifiers for event evidence in explanations; avoid sending raw conversation content as event payload. Use stable references or hashes from the caller system.

## Known Limitations

- The packaged HTTP server uses the in-memory store in v0.2. Selecting `TETHER_RUNTIME_STORE=postgres` fails closed until a durable HTTP store is implemented.
- The API is v0.2 and may change before a tagged stable release.
- The development bearer-token adapter is intentionally minimal and must be replaced before internet exposure.

## Operations

See [docs/OPERATIONS.md](docs/OPERATIONS.md) and [docs/RELEASE.md](docs/RELEASE.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
