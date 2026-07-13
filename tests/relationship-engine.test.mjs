import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryRelationshipStore,
  RelationshipService,
  TetherError
} from "../dist/index.js";

function createTestContext(overrides = {}) {
  return { tenantId: "tenant_test", actorId: "actor_test", scopes: ["model:write", "relationship:write", "relationship:read"], correlationId: "corr_test", ...overrides };
}

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
  const context = createTestContext();
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
  const context = createTestContext();
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
  const context = createTestContext();
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
  const context = createTestContext();
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
    () => service.getExplanation(createTestContext({ tenantId: "other_tenant" }), "rel_1"),
    (error) => error instanceof TetherError && error.code === "RESOURCE_NOT_FOUND"
  );
  assert.throws(
    () => service.createRelationship(createTestContext({ scopes: ["relationship:read"] }), {}),
    (error) => error instanceof TetherError && error.code === "TENANT_SCOPE_DENIED"
  );
});

test("TEST-TETHER-005 rejects missing relationship fields and duplicate resources", () => {
  const { service } = createService();
  const context = createTestContext();
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

test("TEST-TETHER-006 rejects out-of-range models and clamps event transitions", () => {
  const { service } = createService();
  const context = createTestContext();

  assert.throws(
    () =>
      service.createModel(context, {
        ...model,
        axes: [{ id: "trust", min: 0, max: 100, initial: 101 }]
      }),
    (error) => error instanceof TetherError && error.code === "VALIDATION_FAILED"
  );

  service.createModel(context, {
    ...model,
    transitionRules: [
      { id: "trust-huge", eventType: "helpful_interaction", axis: "trust", delta: 500, reasonCode: "HELPFUL" },
      model.transitionRules[1]
    ]
  });
  service.createRelationship(context, {
    id: "rel_clamp",
    modelId: "starter-model",
    modelVersion: "1.0.0",
    subjectRef: "subject_hash_demo"
  });

  const result = service.applyEvent(context, "rel_clamp", { id: "evt_clamp", type: "helpful_interaction" }, "idem_clamp");
  assert.equal(result.relationship.snapshot.values.trust, 100);
  assert.equal(result.explanation.after.trust, 100);
});

test("TEST-TETHER-007 keeps delimiter-bearing tenant, resource, and idempotency keys isolated", () => {
  const { store, service } = createService();
  const left = createTestContext({ tenantId: "tenant:one" });
  const right = createTestContext({ tenantId: "tenant" });
  const leftModel = { ...model, id: "model", version: "v1" };
  const rightModel = { ...model, id: "one:model", version: "v1" };

  service.createModel(left, leftModel);
  service.createModel(right, rightModel);
  service.createRelationship(left, { id: "rel", modelId: leftModel.id, modelVersion: leftModel.version, subjectRef: "left" });
  service.createRelationship(right, { id: "one:rel", modelId: rightModel.id, modelVersion: rightModel.version, subjectRef: "right" });

  const leftResult = service.applyEvent(left, "rel", { id: "event-left", type: "helpful_interaction" }, "event:idem");
  const rightResult = service.applyEvent(right, "one:rel", { id: "event-right", type: "helpful_interaction" }, "idem");

  assert.equal(store.models.size, 2);
  assert.equal(store.relationships.size, 2);
  assert.equal(store.idempotency.size, 2);
  assert.equal(service.getRelationship(left, "rel").subjectRef, "left");
  assert.equal(service.getRelationship(right, "one:rel").subjectRef, "right");
  assert.equal(service.applyEvent(left, "rel", { id: "event-left", type: "helpful_interaction" }, "event:idem"), leftResult);
  assert.equal(service.applyEvent(right, "one:rel", { id: "event-right", type: "helpful_interaction" }, "idem"), rightResult);
});
