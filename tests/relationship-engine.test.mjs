import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryRelationshipStore,
  RelationshipService,
  TetherError,
  createDevelopmentContext
} from "../dist/index.js";

const model = {
  id: "starter-model",
  version: "1.0.0",
  axes: [{ id: "trust", min: 0, max: 100, initial: 50 }],
  events: [{ type: "helpful_interaction" }, { type: "boundary_violation" }],
  transitionRules: [
    { id: "trust-helpful", eventType: "helpful_interaction", axis: "trust", delta: 8, reasonCode: "HELPFUL" },
    { id: "trust-boundary", eventType: "boundary_violation", axis: "trust", delta: -12, reasonCode: "BOUNDARY" }
  ],
  boundaryRules: [
    {
      id: "boundary-no-positive-trust",
      eventType: "boundary_violation",
      axis: "trust",
      blocksPositiveDelta: true,
      policyRef: "policy://boundary/default"
    }
  ],
  decayRules: [{ axis: "trust", perDay: 2 }]
};

function createService() {
  let index = 0;
  const store = new InMemoryRelationshipStore();
  const service = new RelationshipService(store, {
    now: () => "2026-07-05T00:00:00.000Z",
    idGenerator: () => `id_${++index}`
  });
  return { store, service };
}

test("TEST-TETHER-001 applies an event once and records explanation, audit, and outbox", () => {
  const { store, service } = createService();
  const context = createDevelopmentContext();
  service.createModel(context, model);
  service.createRelationship(context, {
    id: "rel_1",
    modelId: "starter-model",
    modelVersion: "1.0.0",
    subjectRef: "subject_hash_demo"
  });

  const first = service.applyEvent(
    context,
    "rel_1",
    { id: "evt_1", type: "helpful_interaction", payload: { sourceRef: "message_hash_1" } },
    "idem_1"
  );
  const replay = service.applyEvent(
    context,
    "rel_1",
    { id: "evt_1", type: "helpful_interaction", payload: { sourceRef: "message_hash_1" } },
    "idem_1"
  );

  assert.equal(first.relationship.snapshot.version, 2);
  assert.equal(replay.relationship.snapshot.version, 2);
  assert.equal(first.relationship.snapshot.values.trust, 58);
  assert.deepEqual(first.explanation.ruleIds, ["trust-helpful"]);
  assert.equal(first.explanation.before.trust, 50);
  assert.equal(first.explanation.after.trust, 58);
  assert.equal(store.auditEvents.some((event) => event.action === "relationship.event_applied"), true);
  assert.equal(store.outboxEvents.some((event) => event.eventType === "tether.relationship.event-applied.v1"), true);
});

test("TEST-TETHER-002 rejects undefined events and reused idempotency keys with different payloads", () => {
  const { service } = createService();
  const context = createDevelopmentContext();
  service.createModel(context, model);
  service.createRelationship(context, {
    id: "rel_1",
    modelId: "starter-model",
    modelVersion: "1.0.0",
    subjectRef: "subject_hash_demo"
  });

  assert.throws(
    () => service.applyEvent(context, "rel_1", { id: "evt_bad", type: "unknown" }, "idem_bad"),
    (error) => error instanceof TetherError && error.code === "VALIDATION_FAILED"
  );

  service.applyEvent(context, "rel_1", { id: "evt_1", type: "helpful_interaction" }, "idem_1");
  assert.throws(
    () => service.applyEvent(context, "rel_1", { id: "evt_2", type: "helpful_interaction" }, "idem_1"),
    (error) => error instanceof TetherError && error.code === "IDEMPOTENCY_CONFLICT"
  );
});

test("TEST-TETHER-003 validates boundary rules fail closed", () => {
  const { service } = createService();
  const context = createDevelopmentContext();
  assert.throws(
    () =>
      service.createModel(context, {
        ...model,
        transitionRules: [
          ...model.transitionRules,
          {
            id: "bad-positive-boundary",
            eventType: "boundary_violation",
            axis: "trust",
            delta: 4,
            reasonCode: "BAD"
          }
        ]
      }),
    (error) => error instanceof TetherError && error.code === "VALIDATION_FAILED"
  );
});

test("TEST-TETHER-004 enforces tenant scope and deterministic decay preview", () => {
  const { service } = createService();
  const context = createDevelopmentContext();
  service.createModel(context, model);
  service.createRelationship(context, {
    id: "rel_1",
    modelId: "starter-model",
    modelVersion: "1.0.0",
    subjectRef: "subject_hash_demo"
  });
  service.applyEvent(context, "rel_1", { id: "evt_1", type: "helpful_interaction" }, "idem_1");

  const preview = service.previewDecay(context, "rel_1", "2026-07-07T00:00:00.000Z");
  assert.equal(preview.values.trust, 54);
  assert.throws(
    () => service.getExplanation(createDevelopmentContext({ tenantId: "other_tenant" }), "rel_1"),
    (error) => error instanceof TetherError && error.code === "RESOURCE_NOT_FOUND"
  );
  assert.throws(
    () => service.createRelationship(createDevelopmentContext({ scopes: ["relationship:read"] }), {}),
    (error) => error instanceof TetherError && error.code === "TENANT_SCOPE_DENIED"
  );
});

test("TEST-TETHER-005 rejects missing relationship fields and duplicate resources", () => {
  const { service } = createService();
  const context = createDevelopmentContext();
  service.createModel(context, model);

  assert.throws(
    () => service.createModel(context, model),
    (error) => error instanceof TetherError && error.code === "RESOURCE_IMMUTABLE"
  );
  assert.throws(
    () => service.createRelationship(context, { modelId: "starter-model", modelVersion: "1.0.0" }),
    (error) => error instanceof TetherError && error.code === "VALIDATION_FAILED"
  );

  service.createRelationship(context, {
    id: "rel_1",
    modelId: "starter-model",
    modelVersion: "1.0.0",
    subjectRef: "subject_hash_demo"
  });
  assert.throws(
    () =>
      service.createRelationship(context, {
        id: "rel_1",
        modelId: "starter-model",
        modelVersion: "1.0.0",
        subjectRef: "subject_hash_demo"
      }),
    (error) => error instanceof TetherError && error.code === "RESOURCE_IMMUTABLE"
  );
});
