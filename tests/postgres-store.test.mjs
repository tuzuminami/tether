import assert from "node:assert/strict";
import test from "node:test";
import {
  PostgresRelationshipStore,
  TETHER_POSTGRES_MIGRATIONS,
  TETHER_POSTGRES_MIGRATION_METADATA,
  TETHER_POSTGRES_ROLLBACK_MIGRATIONS,
  TetherError,
  encodeStorageKey
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
  const client = new FakeClient([{ rows: [] }, { rows: [] }, { rows: [] }, { rows: [{ relationship_id: "rel_pg" }] }]);
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
  const replayClient = new FakeClient([{ rows: [] }, { rows: [] }, { rows: [{ request_hash: "hash_request", result }] }]);
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

  const conflictClient = new FakeClient([{ rows: [] }, { rows: [] }, { rows: [{ request_hash: "different_hash", result }] }]);
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

test("TEST-PG-004 runs checksummed migration ledger work under an advisory transaction lock", async () => {
  assert.equal(TETHER_POSTGRES_MIGRATIONS.length >= 1, true);
  assert.equal(typeof TETHER_POSTGRES_MIGRATIONS[0], "string");
  assert.equal(TETHER_POSTGRES_MIGRATION_METADATA[0].version, "001_initial");
  assert.match(TETHER_POSTGRES_MIGRATION_METADATA[0].checksum, /^[a-f0-9]{64}$/);
  assert.equal(TETHER_POSTGRES_MIGRATION_METADATA[0].statements, TETHER_POSTGRES_MIGRATIONS);
  assert.equal(TETHER_POSTGRES_ROLLBACK_MIGRATIONS.length >= 5, true);
  assert.equal(TETHER_POSTGRES_ROLLBACK_MIGRATIONS[0].startsWith("DROP INDEX"), true);
  assert.equal(TETHER_POSTGRES_ROLLBACK_MIGRATIONS.at(-1), "DROP TABLE IF EXISTS tether_relationship_models");

  const client = new FakeClient([], { respond: legacyMigrationResponses({ tables: Object.keys(legacyColumns()), columns: legacyColumns() }) });
  const pool = new FakePool(client);
  const store = new PostgresRelationshipStore(pool);
  await store.migrate();
  await store.rollbackForDevelopment();

  assert.equal(pool.queries.length, 0);
  assert.equal(client.queries[0].text, "BEGIN");
  assert.equal(client.queries.some((query) => query.text.includes("pg_advisory_xact_lock")), true);
  assert.equal(client.queries.some((query) => query.text.includes("hashtext")), false);
  assert.equal(client.queries.filter((query) => query.text.includes("pg_advisory_xact_lock")).every((query) => /^-?\d+$/.test(query.values[0])), true);
  assert.equal(client.queries.some((query) => query.text.includes("tether_schema_migrations")), true);
  assert.equal(client.queries.some((query) => query.text.startsWith("INSERT INTO tether_schema_migrations")), true);
  const firstCommit = client.queries.findIndex((query) => query.text === "COMMIT");
  assert.equal(client.queries[firstCommit + 1].text, "BEGIN");
  assert.equal(client.queries.at(-1).text, "COMMIT");
  assert.equal(
    client.queries.some((query) => query.text.startsWith("CREATE TABLE IF NOT EXISTS tether_relationship_models")),
    true
  );
  assert.equal(client.queries.some((query) => query.text === "DROP TABLE IF EXISTS tether_relationship_models"), true);
});

test("TEST-PG-007 rejects unknown and checksum-changed applied migrations fail-closed", async () => {
  const unknown = new FakeClient([], { respond: migrationLedgerResponses([{ version: "000_removed", checksum: "deadbeef" }]) });
  await assert.rejects(() => new PostgresRelationshipStore(new FakePool(unknown)).migrate(), /not known to this TETHER build/);
  assert.equal(unknown.queries.at(-1).text, "ROLLBACK");

  const changed = new FakeClient([], { respond: migrationLedgerResponses([{ version: "001_initial", checksum: "changed" }]) });
  await assert.rejects(() => new PostgresRelationshipStore(new FakePool(changed)).migrate(), /checksum changed after it was applied/);
  assert.equal(changed.queries.at(-1).text, "ROLLBACK");
});

test("TEST-PG-008 upgrades legacy text collations and delimiter idempotency scopes before baselining", async () => {
  const tables = [
    "tether_relationship_models",
    "tether_relationships",
    "tether_idempotency_keys",
    "tether_audit_events",
    "tether_outbox_events"
  ];
  const columns = {
    tether_relationship_models: ["tenant_id", "model_id", "model_version", "document", "created_at", "created_by"],
    tether_relationships: ["tenant_id", "relationship_id", "model_id", "model_version", "subject_ref", "snapshot_version", "document", "created_at", "updated_at"],
    tether_idempotency_keys: ["scope", "tenant_id", "request_hash", "result", "created_at"],
    tether_audit_events: ["id", "tenant_id", "actor_id", "action", "resource_id", "correlation_id", "metadata", "created_at"],
    tether_outbox_events: ["id", "tenant_id", "event_type", "resource_id", "correlation_id", "payload", "created_at", "published_at"]
  };
  const legacy = new FakeClient([], { respond: legacyMigrationResponses({ tables, columns, legacyScopes: [{ scope: "tenant_pg:rel_pg:idem:with:delimiter", tenant_id: "tenant_pg", relationship_id: "rel_pg" }] }) });
  await new PostgresRelationshipStore(new FakePool(legacy)).migrate();
  assert.equal(legacy.queries.some((query) => query.text.includes("FROM pg_attribute")), true);
  assert.equal(legacy.queries.some((query) => query.text.includes("pg_constraint")), true);
  assert.equal(legacy.queries.some((query) => query.text.includes("pg_index")), true);
  assert.equal(legacy.queries.some((query) => query.text.includes("pg_collation")), true);
  assert.equal(legacy.queries.some((query) => query.text.includes('ALTER COLUMN tenant_id TYPE text COLLATE "C"')), true);
  const scopeUpgrade = legacy.queries.find((query) => query.text.startsWith("UPDATE tether_idempotency_keys SET scope"));
  assert.deepEqual(scopeUpgrade.values, [encodeStorageKey("idempotency", "tenant_pg", "rel_pg", "idem:with:delimiter"), "tenant_pg:rel_pg:idem:with:delimiter", "tenant_pg"]);
  assert.equal(legacy.queries.some((query) => query.text.startsWith("INSERT INTO tether_schema_migrations")), true);
  assert.equal(legacy.queries.some((query) => query.text.startsWith("CREATE TABLE IF NOT EXISTS tether_relationships")), true);

  const incomplete = new FakeClient([], {
    respond: legacyMigrationResponses({ tables: ["tether_relationships"], columns: {} })
  });
  await assert.rejects(
    () => new PostgresRelationshipStore(new FakePool(incomplete)).migrate(),
    /Legacy TETHER schema is incomplete/
  );

  const invalidType = new FakeClient([], { respond: legacyMigrationResponses({ tables, columns, columnOverride: { table: "tether_relationships", column: "snapshot_version", type_name: "text" } }) });
  await assert.rejects(
    () => new PostgresRelationshipStore(new FakePool(invalidType)).migrate(),
    /incompatible type or nullability/
  );
  assert.equal(invalidType.queries.some((query) => query.text.startsWith("INSERT INTO tether_schema_migrations")), false);

  const missingDefault = new FakeClient([], { respond: legacyMigrationResponses({ tables, columns, columnOverride: { table: "tether_idempotency_keys", column: "created_at", column_default: null } }) });
  await assert.rejects(() => new PostgresRelationshipStore(new FakePool(missingDefault)).migrate(), /missing its required default/);

  const missingIndex = new FakeClient([], { respond: legacyMigrationResponses({ tables, columns, indexes: legacyIndexes().slice(0, 2) }) });
  await assert.rejects(() => new PostgresRelationshipStore(new FakePool(missingIndex)).migrate(), /required index .* missing or incompatible/);
});

test("TEST-PG-014 accepts PostgreSQL name[] constraint catalog results while preserving exact key validation", async () => {
  const client = new FakeClient([], {
    respond: legacyMigrationResponses({
      tables: Object.keys(legacyColumns()),
      columns: legacyColumns(),
      constraintColumns: "postgres-name-array"
    })
  });

  await new PostgresRelationshipStore(new FakePool(client)).migrate();
  assert.equal(client.queries.some((query) => query.text.startsWith("INSERT INTO tether_schema_migrations")), true);

  const malformed = new FakeClient([], {
    respond: legacyMigrationResponses({
      tables: Object.keys(legacyColumns()),
      columns: legacyColumns(),
      constraintColumns: "malformed"
    })
  });
  await assert.rejects(
    () => new PostgresRelationshipStore(new FakePool(malformed)).migrate(),
    /tether_relationship_models is missing its required primary key/
  );
});

test("TEST-PG-012 locks every baseline table in fixed DDL order before scope conversion", async () => {
  const legacy = new FakeClient([], {
    respond: legacyMigrationResponses({
      tables: Object.keys(legacyColumns()),
      columns: legacyColumns(),
      legacyScopes: [{ scope: "tenant_pg:rel_pg:idem_pg", tenant_id: "tenant_pg", relationship_id: "rel_pg" }]
    })
  });

  await new PostgresRelationshipStore(new FakePool(legacy)).migrate();

  const locks = legacy.queries.filter((query) => query.text.startsWith("LOCK TABLE"));
  assert.deepEqual(locks.map((query) => query.text), [
    "LOCK TABLE tether_relationship_models IN SHARE ROW EXCLUSIVE MODE",
    "LOCK TABLE tether_relationships IN SHARE ROW EXCLUSIVE MODE",
    "LOCK TABLE tether_idempotency_keys IN SHARE ROW EXCLUSIVE MODE",
    "LOCK TABLE tether_audit_events IN SHARE ROW EXCLUSIVE MODE",
    "LOCK TABLE tether_outbox_events IN SHARE ROW EXCLUSIVE MODE"
  ]);
  const lastLock = legacy.queries.lastIndexOf(locks.at(-1));
  const scopeScan = legacy.queries.findIndex((query) => query.text.startsWith("SELECT scope, tenant_id,"));
  const scopeConversion = legacy.queries.findIndex((query) => query.text.startsWith("UPDATE tether_idempotency_keys SET scope"));
  assert.equal(lastLock < scopeScan, true);
  assert.equal(lastLock < scopeConversion, true);
  assert.equal(legacy.queries.at(-1).text, "COMMIT");
});

test("TEST-PG-013 re-detects and revalidates empty-db baseline state after DDL before ledger insert", async () => {
  const client = new FakeClient([], {
    respond(text) {
      return legacyMigrationResponses({ tables: Object.keys(legacyColumns()), columns: legacyColumns() })(text);
    }
  });

  await new PostgresRelationshipStore(new FakePool(client)).migrate();

  const initialDdl = client.queries.findIndex((query) => query.text.startsWith("CREATE TABLE IF NOT EXISTS tether_relationship_models"));
  const firstLock = client.queries.findIndex((query) => query.text.startsWith("LOCK TABLE"));
  const tableDetection = client.queries.findIndex((query) => query.text.includes("FROM information_schema.tables"));
  const schemaValidation = client.queries.findIndex((query) => query.text.includes("FROM pg_attribute"));
  const jsonValidation = client.queries.findIndex((query) => query.text.includes("WITH mismatches"));
  const scopeValidation = client.queries.findIndex((query) => query.text.includes("tether baseline scope revalidation"));
  const ledgerInsert = client.queries.findIndex((query) => query.text.startsWith("INSERT INTO tether_schema_migrations"));
  assert.equal(initialDdl < firstLock, true);
  assert.equal(initialDdl < tableDetection, true);
  assert.equal(firstLock < schemaValidation, true);
  assert.equal(schemaValidation < jsonValidation, true);
  assert.equal(jsonValidation < scopeValidation, true);
  assert.equal(scopeValidation < ledgerInsert, true);
});

test("TEST-PG-011 rejects an ambiguous legacy delimiter scope before it can be baselined", async () => {
  const tables = ["tether_relationship_models", "tether_relationships", "tether_idempotency_keys", "tether_audit_events", "tether_outbox_events"];
  const columns = legacyColumns();
  const client = new FakeClient([], { respond: legacyMigrationResponses({ tables, columns, legacyScopes: [{ scope: "other:scope", tenant_id: "tenant_pg", relationship_id: "rel_pg" }] }) });

  await assert.rejects(() => new PostgresRelationshipStore(new FakePool(client)).migrate(), /cannot be upgraded without changing replay semantics/);
  assert.equal(client.queries.some((query) => query.text.startsWith("INSERT INTO tether_schema_migrations")), false);
  assert.equal(client.queries.at(-1).text, "ROLLBACK");
});

test("TEST-PG-010 rejects mismatched legacy relationship JSON before baselining can enable cross-tenant lookup or update", async () => {
  const tables = [
    "tether_relationship_models",
    "tether_relationships",
    "tether_idempotency_keys",
    "tether_audit_events",
    "tether_outbox_events"
  ];
  const columns = {
    tether_relationship_models: ["tenant_id", "model_id", "model_version", "document", "created_at", "created_by"],
    tether_relationships: ["tenant_id", "relationship_id", "model_id", "model_version", "subject_ref", "snapshot_version", "document", "created_at", "updated_at"],
    tether_idempotency_keys: ["scope", "tenant_id", "request_hash", "result", "created_at"],
    tether_audit_events: ["id", "tenant_id", "actor_id", "action", "resource_id", "correlation_id", "metadata", "created_at"],
    tether_outbox_events: ["id", "tenant_id", "event_type", "resource_id", "correlation_id", "payload", "created_at", "published_at"]
  };
  const client = new FakeClient([], {
    respond: legacyMigrationResponses({
      tables,
      columns,
      mismatch: [{ document_kind: "relationship document", tenant_id: "tenant_pg", record_id: "rel_pg" }]
    })
  });

  await assert.rejects(
    () => new PostgresRelationshipStore(new FakePool(client)).migrate(),
    /authoritative JSON is incompatible.*relationship document identity mismatch/
  );
  assert.equal(client.queries.some((query) => query.text.startsWith("CREATE TABLE IF NOT EXISTS tether_schema_migrations")), true);
  assert.equal(client.queries.some((query) => query.text.startsWith("INSERT INTO tether_schema_migrations")), false);
  assert.equal(client.queries.some((query) => query.text.includes("UPDATE tether_relationships")), false);
  const validation = client.queries.find((query) => query.text.includes("WITH mismatches"));
  assert.equal(validation.text.includes("document->>'tenantId' IS DISTINCT FROM tenant_id"), true);
  assert.equal(validation.text.includes("keys.result #>> '{relationship,tenantId}' IS DISTINCT FROM keys.tenant_id"), true);
  assert.equal(client.queries.at(-1).text, "ROLLBACK");
});

test("TEST-PG-009 serializes relationship and idempotency scopes and rejects stale updates", async () => {
  const client = new FakeClient([{ rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }]);
  await assert.rejects(
    () => new PostgresRelationshipStore(new FakePool(client)).saveEventApplication({
      relationship,
      explanation,
      idempotencyScope: "tenant_pg:rel_pg:idem_pg",
      requestHash: "hash_request",
      result,
      auditEvent,
      outboxEvent
    }),
    (error) => error instanceof TetherError && error.code === "VERSION_CONFLICT"
  );
  assert.equal(client.queries.filter((query) => query.text.includes("pg_advisory_xact_lock")).length, 2);
  const lockKeys = client.queries.filter((query) => query.text.includes("pg_advisory_xact_lock")).map((query) => BigInt(query.values[0]));
  assert.deepEqual(lockKeys, [...lockKeys].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)));
  assert.equal(client.queries.some((query) => query.text.includes("hashtext")), false);
  const update = client.queries.find((query) => query.text.includes("UPDATE tether_relationships"));
  assert.equal(update.text.includes("snapshot_version = $6"), true);
  assert.equal(update.text.includes("RETURNING relationship_id"), true);
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

test("TEST-PG-010 uses distinct structured scopes and advisory locks for delimiter collisions", async () => {
  const leftScope = encodeStorageKey("idempotency", "tenant:one", "rel", "event:idem");
  const rightScope = encodeStorageKey("idempotency", "tenant", "one:rel", "idem");
  assert.notEqual(leftScope, rightScope);

  const leftRelationship = { ...relationship, tenantId: "tenant:one", id: "rel" };
  const rightRelationship = { ...relationship, tenantId: "tenant", id: "one:rel" };
  const saved = await Promise.all([
    new PostgresRelationshipStore(new FakePool(new FakeClient(saveEventResults()))).saveEventApplication({ ...eventApplication(leftRelationship), idempotencyScope: leftScope }),
    new PostgresRelationshipStore(new FakePool(new FakeClient(saveEventResults()))).saveEventApplication({ ...eventApplication(rightRelationship), idempotencyScope: rightScope })
  ]);
  assert.equal(saved.length, 2);
});

test("TEST-PG-014 runs the durable readiness probe as a safe pool query", async () => {
  const pool = new FakePool(new FakeClient());
  await new PostgresRelationshipStore(pool).checkReadiness();
  assert.deepEqual(pool.queries, [{ text: "SELECT 1", values: [] }]);
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

function eventApplication(eventRelationship) {
  return {
    relationship: eventRelationship,
    explanation: { ...explanation, relationshipId: eventRelationship.id },
    requestHash: "hash_request",
    result: { relationship: eventRelationship, explanation: { ...explanation, relationshipId: eventRelationship.id } },
    auditEvent: { ...auditEvent, tenantId: eventRelationship.tenantId, resourceId: eventRelationship.id },
    outboxEvent: { ...outboxEvent, tenantId: eventRelationship.tenantId, resourceId: eventRelationship.id }
  };
}

function saveEventResults() {
  return [{ rows: [] }, { rows: [] }, { rows: [] }, { rows: [{ relationship_id: "rel_pg" }] }, { rows: [] }, { rows: [] }, { rows: [] }];
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
    const response = this.options.respond?.(text, values);
    if (response !== undefined) return response;
    return this.results.shift() ?? { rows: [] };
  }

  release() {
    this.released = true;
  }
}

function legacyMigrationResponses({ tables, columns, columnOverride, indexes = legacyIndexes(), legacyScopes = [], mismatch = [], constraintColumns = "array" }) {
  return (text) => {
    if (text.includes("tether baseline scope revalidation")) return { rows: [] };
    if (text.includes("FROM information_schema.tables")) return { rows: tables.map((table_name) => ({ table_name })) };
    if (text.startsWith("SELECT scope, tenant_id,")) return { rows: legacyScopes };
    if (text.startsWith("ALTER TABLE") || text.startsWith("UPDATE tether_idempotency_keys") || text.startsWith("CREATE TABLE IF NOT EXISTS tether_schema_migrations") || text.startsWith("INSERT INTO tether_schema_migrations")) return { rows: [] };
    if (text.includes("FROM pg_attribute")) return { rows: legacyColumnRows(columns, columnOverride) };
    if (text.includes("FROM pg_constraint")) return { rows: legacyPrimaryKeys(constraintColumns) };
    if (text.includes("FROM pg_index")) return { rows: indexes };
    if (text.includes("WITH mismatches")) return { rows: mismatch };
    if (text.includes("SELECT version, checksum FROM tether_schema_migrations")) return { rows: [] };
    return { rows: [] };
  };
}

function migrationLedgerResponses(rows) {
  return (text) => text.includes("SELECT version, checksum FROM tether_schema_migrations") ? { rows } : { rows: [] };
}

function legacyColumns() {
  return {
    tether_relationship_models: ["tenant_id", "model_id", "model_version", "document", "created_at", "created_by"],
    tether_relationships: ["tenant_id", "relationship_id", "model_id", "model_version", "subject_ref", "snapshot_version", "document", "created_at", "updated_at"],
    tether_idempotency_keys: ["scope", "tenant_id", "request_hash", "result", "created_at"],
    tether_audit_events: ["id", "tenant_id", "actor_id", "action", "resource_id", "correlation_id", "metadata", "created_at"],
    tether_outbox_events: ["id", "tenant_id", "event_type", "resource_id", "correlation_id", "payload", "created_at", "published_at"]
  };
}

function legacyColumnRows(columns, override) {
  const jsonColumns = new Set(["document", "result", "metadata", "payload"]);
  const timestampColumns = new Set(["created_at", "updated_at", "published_at"]);
  return Object.entries(columns).flatMap(([table_name, names]) => names.map((column_name) => {
    const type_name = column_name === "snapshot_version" ? "integer" : jsonColumns.has(column_name) ? "jsonb" : timestampColumns.has(column_name) ? "timestamp with time zone" : "text";
    const row = { table_name, column_name, type_name, is_nullable: table_name === "tether_outbox_events" && column_name === "published_at", column_default: table_name === "tether_idempotency_keys" && column_name === "created_at" ? "now()" : null, collation_name: type_name === "text" ? "C" : null };
    return override?.table === table_name && override.column === column_name ? { ...row, ...override } : row;
  }));
}

function legacyPrimaryKeys(columns = "array") {
  const catalogColumns = (names) => {
    if (columns === "postgres-name-array") return `{${names.join(",")}}`;
    if (columns === "malformed") return "not-a-postgres-array";
    return names;
  };
  return [
    { table_name: "tether_relationship_models", constraint_type: "p", columns: catalogColumns(["tenant_id", "model_id", "model_version"]) },
    { table_name: "tether_relationships", constraint_type: "p", columns: catalogColumns(["tenant_id", "relationship_id"]) },
    { table_name: "tether_idempotency_keys", constraint_type: "p", columns: catalogColumns(["scope"]) },
    { table_name: "tether_audit_events", constraint_type: "p", columns: catalogColumns(["id"]) },
    { table_name: "tether_outbox_events", constraint_type: "p", columns: catalogColumns(["id"]) }
  ];
}

function legacyIndexes() {
  return [
    { table_name: "tether_relationships", index_name: "tether_relationships_tenant_model_idx", index_definition: "CREATE INDEX tether_relationships_tenant_model_idx ON tether_relationships (tenant_id, model_id, model_version)" },
    { table_name: "tether_audit_events", index_name: "tether_audit_events_tenant_resource_idx", index_definition: "CREATE INDEX tether_audit_events_tenant_resource_idx ON tether_audit_events (tenant_id, resource_id, created_at)" },
    { table_name: "tether_outbox_events", index_name: "tether_outbox_events_unpublished_idx", index_definition: "CREATE INDEX tether_outbox_events_unpublished_idx ON tether_outbox_events (tenant_id, created_at) WHERE (published_at IS NULL)" }
  ];
}
