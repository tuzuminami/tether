import assert from "node:assert/strict";
import test from "node:test";
import {
  PostgresRelationshipStore,
  TETHER_POSTGRES_MIGRATIONS,
  TETHER_POSTGRES_ROLLBACK_MIGRATIONS,
  TetherError
} from "../dist/index.js";

const relationship = {
  id: "rel_pg",
  tenantId: "tenant_pg",
  subjectRef: "subject_hash",
  modelId: "model_pg",
  modelVersion: "1.0.0",
  snapshot: {
    version: 2,
    values: { trust: 55 },
    modelId: "model_pg",
    modelVersion: "1.0.0",
    updatedAt: "2026-07-05T00:00:00.000Z"
  },
  explanations: [],
  createdAt: "2026-07-05T00:00:00.000Z",
  createdBy: "actor_pg",
  updatedAt: "2026-07-05T00:00:00.000Z"
};

const explanation = {
  id: "exp_pg",
  relationshipId: "rel_pg",
  snapshotVersion: 2,
  eventId: "evt_pg",
  eventType: "helpful_interaction",
  eventHash: "hash_event",
  ruleIds: ["trust-helpful"],
  before: { trust: 50 },
  after: { trust: 55 },
  warnings: [],
  reasonCode: "TRANSITION_APPLIED",
  createdAt: "2026-07-05T00:00:00.000Z"
};

const result = { relationship, explanation };
const auditEvent = {
  id: "audit_pg",
  tenantId: "tenant_pg",
  actorId: "actor_pg",
  action: "relationship.event_applied",
  resourceId: "rel_pg",
  correlationId: "corr_pg",
  metadata: { eventHash: "hash_event" },
  createdAt: "2026-07-05T00:00:00.000Z"
};
const outboxEvent = {
  id: "outbox_pg",
  tenantId: "tenant_pg",
  eventType: "tether.relationship.event-applied.v1",
  resourceId: "rel_pg",
  correlationId: "corr_pg",
  payload: { snapshotVersion: 2 },
  createdAt: "2026-07-05T00:00:00.000Z"
};

test("TEST-PG-001 saves event application with same-client transaction and tenant-scoped SQL", async () => {
  const client = new FakeClient([{ rows: [] }]);
  const pool = new FakePool(client);
  const store = new PostgresRelationshipStore(pool);

  const saved = await store.saveEventApplication({
    relationship,
    explanation,
    idempotencyScope: "tenant_pg:rel_pg:idem_pg",
    requestHash: "hash_request",
    result,
    auditEvent,
    outboxEvent
  });

  assert.deepEqual(saved, result);
  assert.equal(pool.queries.length, 0);
  assert.equal(client.released, true);
  assert.equal(client.queries[0].text, "BEGIN");
  assert.equal(client.queries.at(-1).text, "COMMIT");
  assert.equal(client.queries.some((query) => query.text.includes("FOR UPDATE")), true);
  assert.equal(client.queries.some((query) => query.text.includes("WHERE tenant_id = $4 AND relationship_id = $5")), true);
  assert.equal(client.queries.some((query) => query.text.includes("tether_audit_events")), true);
  assert.equal(client.queries.some((query) => query.text.includes("tether_outbox_events")), true);
  assert.equal(client.queries.some((query) => query.text.includes("tether_idempotency_keys")), true);
});

test("TEST-PG-002 replays saved idempotency result and rejects conflicts", async () => {
  const replayClient = new FakeClient([{ rows: [{ request_hash: "hash_request", result }] }]);
  const replayStore = new PostgresRelationshipStore(new FakePool(replayClient));
  assert.deepEqual(
    await replayStore.saveEventApplication({
      relationship,
      explanation,
      idempotencyScope: "tenant_pg:rel_pg:idem_pg",
      requestHash: "hash_request",
      result,
      auditEvent,
      outboxEvent
    }),
    result
  );
  assert.equal(replayClient.queries.some((query) => query.text.includes("UPDATE tether_relationships")), false);

  const conflictClient = new FakeClient([{ rows: [{ request_hash: "different_hash", result }] }]);
  const conflictStore = new PostgresRelationshipStore(new FakePool(conflictClient));
  await assert.rejects(
    () =>
      conflictStore.saveEventApplication({
        relationship,
        explanation,
        idempotencyScope: "tenant_pg:rel_pg:idem_pg",
        requestHash: "hash_request",
        result,
        auditEvent,
        outboxEvent
      }),
    (error) => error instanceof TetherError && error.code === "IDEMPOTENCY_CONFLICT"
  );
  assert.equal(conflictClient.queries.at(-1).text, "ROLLBACK");
  assert.equal(conflictClient.released, true);
});

test("TEST-PG-003 rolls back and maps unique violations to immutable resource errors", async () => {
  const client = new FakeClient([], { failOn: "INSERT INTO tether_relationship_models", code: "23505" });
  const store = new PostgresRelationshipStore(new FakePool(client));

  await assert.rejects(
    () =>
      store.createModel(
        {
          id: "model_pg",
          version: "1.0.0",
          tenantId: "tenant_pg",
          axes: [{ id: "trust", min: 0, max: 100, initial: 50 }],
          events: [{ type: "helpful_interaction" }],
          transitionRules: [
            { id: "trust-helpful", eventType: "helpful_interaction", axis: "trust", delta: 5, reasonCode: "HELPFUL" }
          ],
          boundaryRules: [],
          decayRules: [],
          createdAt: "2026-07-05T00:00:00.000Z",
          createdBy: "actor_pg",
          resourceVersion: 1
        },
        auditEvent
      ),
    (error) => error instanceof TetherError && error.code === "RESOURCE_IMMUTABLE"
  );
  assert.equal(client.queries[0].text, "BEGIN");
  assert.equal(client.queries.at(-1).text, "ROLLBACK");
  assert.equal(client.released, true);
});

test("TEST-PG-004 runs upgrade and rollback migration statements inside transactions", async () => {
  assert.equal(TETHER_POSTGRES_MIGRATIONS.length >= 5, true);
  assert.equal(TETHER_POSTGRES_ROLLBACK_MIGRATIONS.length >= 5, true);
  assert.equal(TETHER_POSTGRES_ROLLBACK_MIGRATIONS[0].startsWith("DROP INDEX"), true);
  assert.equal(TETHER_POSTGRES_ROLLBACK_MIGRATIONS.at(-1), "DROP TABLE IF EXISTS tether_relationship_models");

  const client = new FakeClient();
  const pool = new FakePool(client);
  const store = new PostgresRelationshipStore(pool);
  await store.migrate();
  await store.rollbackForDevelopment();

  assert.equal(pool.queries.length, 0);
  assert.equal(client.queries[0].text, "BEGIN");
  assert.equal(client.queries[TETHER_POSTGRES_MIGRATIONS.length + 1].text, "COMMIT");
  assert.equal(client.queries[TETHER_POSTGRES_MIGRATIONS.length + 2].text, "BEGIN");
  assert.equal(client.queries.at(-1).text, "COMMIT");
  assert.equal(
    client.queries.some((query) => query.text.startsWith("CREATE TABLE IF NOT EXISTS tether_relationship_models")),
    true
  );
  assert.equal(client.queries.some((query) => query.text === "DROP TABLE IF EXISTS tether_relationship_models"), true);
});

test("TEST-PG-005 rolls back relationship, audit, and outbox writes as one transaction", async () => {
  const client = new FakeClient([], { failOn: "INSERT INTO tether_outbox_events" });
  const store = new PostgresRelationshipStore(new FakePool(client));

  await assert.rejects(() => store.createRelationship(relationship, auditEvent, outboxEvent), /query failed/);
  assert.equal(client.queries[0].text, "BEGIN");
  assert.equal(client.queries.some((query) => query.text.includes("INSERT INTO tether_relationships")), true);
  assert.equal(client.queries.some((query) => query.text.includes("INSERT INTO tether_audit_events")), true);
  assert.equal(client.queries.some((query) => query.text.includes("INSERT INTO tether_outbox_events")), true);
  assert.equal(client.queries.some((query) => query.text === "COMMIT"), false);
  assert.equal(client.queries.at(-1).text, "ROLLBACK");
  assert.equal(client.released, true);
});

test("TEST-PG-006 reads models and relationships through tenant-scoped SQL only", async () => {
  const pool = new FakePool(new FakeClient());
  const store = new PostgresRelationshipStore(pool);

  await store.getModel("tenant_pg", "model_pg", "1.0.0");
  await store.getRelationship("tenant_pg", "rel_pg");

  assert.equal(pool.queries[0].text.includes("WHERE tenant_id = $1 AND model_id = $2 AND model_version = $3"), true);
  assert.deepEqual(pool.queries[0].values, ["tenant_pg", "model_pg", "1.0.0"]);
  assert.equal(pool.queries[1].text.includes("WHERE tenant_id = $1 AND relationship_id = $2"), true);
  assert.deepEqual(pool.queries[1].values, ["tenant_pg", "rel_pg"]);
});

class FakePool {
  constructor(client) {
    this.client = client;
    this.queries = [];
  }

  async query(text, values = []) {
    this.queries.push({ text, values });
    return { rows: [] };
  }

  async connect() {
    return this.client;
  }

  async end() {}
}

class FakeClient {
  constructor(results = [], options = {}) {
    this.results = [...results];
    this.options = options;
    this.queries = [];
    this.released = false;
  }

  async query(text, values = []) {
    this.queries.push({ text, values });
    if (this.options.failOn !== undefined && text.includes(this.options.failOn)) {
      throw Object.assign(new Error("query failed"), { code: this.options.code });
    }
    if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") {
      return { rows: [] };
    }
    return this.results.shift() ?? { rows: [] };
  }

  release() {
    this.released = true;
  }
}
