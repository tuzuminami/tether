# TETHER

TETHER is an explainable relationship state engine for AI products, games, education tools, community systems, and other conversational software.

It models relationship state as explicit versioned data: axes, bounded values, declared events, transition rules, boundary rules, deterministic decay, snapshots, and explanations. It does not infer real human emotions, diagnose users, optimize dependency, or mutate state from opaque model output.

## Current MVP

- Relationship model validation with axes, events, transition rules, boundary rules, and decay rules.
- Fail-closed rejection for undefined events, out-of-range declarations, and positive state progression from boundary-blocked events.
- Relationship creation pinned to a model version.
- Idempotent event application with stable conflict detection.
- Explainable snapshots with rule IDs, before/after state, event hashes, warnings, audit events, and outbox events.
- Tenant-scoped access checks and stable error codes.
- Minimal HTTP API with request/response envelopes.
- Public boundary guard to prevent private operator material from being committed.

## Non-Goals

- No chat UI or companion application shell.
- No model inference or provider routing.
- No emotional scoring, attachment maximization, therapy, diagnosis, or claims of genuine feelings.
- No hidden prompt-only safety mechanism.

## Quick Start

```bash
npm run verify
npm run build
PORT=3000 node apps/api/server.mjs
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

## API Contract

See [openapi/openapi.yaml](openapi/openapi.yaml).

Protected endpoints require:

- `Authorization: Bearer dev-token` for the development adapter.
- `X-Tenant-Id`.
- `X-Correlation-Id` where available.
- `Idempotency-Key` for event application.

## Development

```bash
npm run check:private-boundary
npm run build
npm test
npm run verify
```

`npm test` opens a local HTTP listener for API tests. In restricted sandboxes, run it with permission for local loopback binding.

## Security Model

The current development adapter is intentionally narrow and rejects missing or invalid bearer credentials. Production deployments should replace it with a real auth adapter before exposing the API.

TETHER stores hashes and identifiers for event evidence in explanations; avoid sending raw conversation content as event payload. Use stable references or hashes from the caller system.

## Known Limitations

- The MVP uses an in-memory store. PostgreSQL migrations and durable transaction tests are the next production-hardening step.
- The API is v0.1 and may change before a tagged stable release.
- The package currently avoids external runtime dependencies to keep local verification deterministic.

## License

Apache-2.0. See [LICENSE.md](LICENSE.md).
