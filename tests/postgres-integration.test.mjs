import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  PostgresRelationshipService,
  PostgresRelationshipStore,
  TETHER_POSTGRES_MIGRATION_METADATA,
  TetherError,
  encodeStorageKey
} from "../dist/index.js";

const databaseUrl = process.env.TETHER_TEST_DATABASE_URL;
const integration = databaseUrl === undefined ? test.skip : test;
const shippedV1Ddl = readFileSync(fileURLToPath(new URL("./fixtures/postgres-shipped-v1.sql", import.meta.url)), "utf8");

const model = {
  id: "postgres-integration-model",
  version: "1.0.0",
  axes: [{ id: "trust", min: 0, max: 100, initial: 10 }],
  events: [{ type: "helpful_interaction" }],
  transitionRules: [{ id: "trust-helpful", eventType: "helpful_interaction", axis: "trust", delta: 5, reasonCode: "HELPFUL" }],
  boundaryRules: [],
  decayRules: []
};

integration("TEST-PG-INT-001 proves PostgreSQL 16 migration, retry, concurrent replay, and durable service behavior", { concurrency: false }, async () => {
  const admin = new Pool({ connectionString: databaseUrl });
  const freshSchema = schemaName("fresh");
  const legacySchema = schemaName("legacy");
  const verificationPool = poolFor(freshSchema);
  let freshFirst;
  let freshSecond;
  let persistedStore;
  let legacyFirst;
  let legacySecond;
  let legacySeedStore;
  try {
    await admin.query(`CREATE SCHEMA ${freshSchema}`);
    freshFirst = storeFor(freshSchema);
    freshSecond = storeFor(freshSchema);
    await Promise.all([freshFirst.migrate(), freshSecond.migrate()]);
    assert.equal((await verificationPool.query("SELECT version FROM tether_schema_migrations")).rows.length, 1);

    const firstService = new PostgresRelationshipService(freshFirst);
    const secondService = new PostgresRelationshipService(freshSecond);
    const tenantA = context("tenant-postgres-a");
    const tenantB = context("tenant-postgres-b");
    await firstService.createModel(tenantA, model);
    const relationship = await firstService.createRelationship(tenantA, {
      id: "relationship-postgres",
      modelId: model.id,
      modelVersion: model.version,
      subjectRef: "subject-a"
    });
    await firstService.createModel(tenantB, model);
    await secondService.createRelationship(tenantB, {
      id: relationship.id,
      modelId: model.id,
      modelVersion: model.version,
      subjectRef: "subject-b"
    });

    const event = { id: "event-postgres", type: "helpful_interaction" };
    const [firstApply, concurrentReplay] = await Promise.all([
      firstService.applyEvent(tenantA, relationship.id, event, "same-request"),
      secondService.applyEvent(tenantA, relationship.id, event, "same-request")
    ]);
    assert.equal(firstApply.relationship.snapshot.version, 2);
    assert.deepEqual(concurrentReplay, firstApply);
    await assert.rejects(
      () => secondService.getExplanation(tenantB, relationship.id),
      (error) => error instanceof TetherError && error.code === "RESOURCE_NOT_FOUND"
    );

    const sideEffects = await verificationPool.query(
      `SELECT
         (SELECT count(*)::int FROM tether_audit_events WHERE tenant_id = $1 AND resource_id = $2 AND action = 'relationship.event_applied') AS audits,
         (SELECT count(*)::int FROM tether_outbox_events WHERE tenant_id = $1 AND resource_id = $2 AND event_type = 'tether.relationship.event-applied.v1') AS outbox`,
      [tenantA.tenantId, relationship.id]
    );
    assert.deepEqual(sideEffects.rows[0], { audits: 1, outbox: 1 });

    persistedStore = storeFor(freshSchema);
    const persistedService = new PostgresRelationshipService(persistedStore);
    const persisted = await persistedService.getExplanation(tenantA, relationship.id);
    assert.equal(persisted.eventId, event.id);
    assert.equal(persisted.snapshotVersion, 2);

    const duplicateOutbox = (await verificationPool.query("SELECT id FROM tether_outbox_events LIMIT 1")).rows[0].id;
    await assert.rejects(
      () => freshFirst.createRelationship(
        { ...relationship, id: "relationship-rolled-back", subjectRef: "subject-rolled-back" },
        auditEvent(tenantA, "audit-rolled-back", "relationship-rolled-back"),
        outboxEvent(tenantA, duplicateOutbox, "relationship-rolled-back")
      ),
      (error) => error instanceof TetherError && error.code === "RESOURCE_IMMUTABLE"
    );
    assert.equal((await verificationPool.query("SELECT count(*)::int AS count FROM tether_relationships WHERE relationship_id = 'relationship-rolled-back'")).rows[0].count, 0);
    assert.equal((await verificationPool.query("SELECT count(*)::int AS count FROM tether_audit_events WHERE id = 'audit-rolled-back'")).rows[0].count, 0);

    await admin.query(`CREATE SCHEMA ${legacySchema}`);
    const legacyPool = poolFor(legacySchema);
    await legacyPool.query(shippedV1Ddl);
    legacySeedStore = new PostgresRelationshipStore(legacyPool);
    const legacyService = new PostgresRelationshipService(legacySeedStore, fixedOptions("legacy"));
    const legacyContext = context("tenant:legacy");
    await legacyService.createModel(legacyContext, model);
    const legacyRelationship = await legacyService.createRelationship(legacyContext, {
      id: "relationship:legacy",
      modelId: model.id,
      modelVersion: model.version,
      subjectRef: "subject:legacy"
    });
    const legacyReplay = await legacyService.applyEvent(
      legacyContext,
      legacyRelationship.id,
      { id: "event:legacy", type: "helpful_interaction" },
      "replay:key"
    );
    const oldDelimiterScope = `${legacyContext.tenantId}:${legacyRelationship.id}:replay:key`;
    await legacyPool.query(
      "UPDATE tether_idempotency_keys SET scope = $1 WHERE tenant_id = $2",
      [oldDelimiterScope, legacyContext.tenantId]
    );
    legacyFirst = storeFor(legacySchema);
    legacySecond = storeFor(legacySchema);
    await Promise.all([legacyFirst.migrate(), legacySecond.migrate()]);
    assert.deepEqual(
      (await legacyPool.query("SELECT version, checksum FROM tether_schema_migrations")).rows,
      [{ version: "001_initial", checksum: TETHER_POSTGRES_MIGRATION_METADATA[0].checksum }]
    );
    const migratedScope = encodeStorageKey("idempotency", legacyContext.tenantId, legacyRelationship.id, "replay:key");
    assert.deepEqual(
      (await legacyPool.query("SELECT scope, tenant_id FROM tether_idempotency_keys")).rows,
      [{ scope: migratedScope, tenant_id: legacyContext.tenantId }]
    );
    assert.deepEqual(
      await new PostgresRelationshipService(legacyFirst, fixedOptions("legacy-replay")).applyEvent(
        legacyContext,
        legacyRelationship.id,
        { id: "event:legacy", type: "helpful_interaction" },
        "replay:key"
      ),
      legacyReplay
    );
    assert.deepEqual(
      (await legacyPool.query(
        "SELECT tenant_id, relationship_id, snapshot_version, document->>'subjectRef' AS subject_ref FROM tether_relationships WHERE tenant_id = $1 AND relationship_id = $2",
        [legacyContext.tenantId, legacyRelationship.id]
      )).rows,
      [{
        tenant_id: legacyContext.tenantId,
        relationship_id: legacyRelationship.id,
        snapshot_version: 2,
        subject_ref: "subject:legacy"
      }]
    );

  } finally {
    await Promise.allSettled([
      freshFirst?.close(),
      freshSecond?.close(),
      persistedStore?.close(),
      legacyFirst?.close(),
      legacySecond?.close(),
      legacySeedStore?.close(),
      verificationPool.end()
    ]);
    await admin.query(`DROP SCHEMA IF EXISTS ${freshSchema} CASCADE`);
    await admin.query(`DROP SCHEMA IF EXISTS ${legacySchema} CASCADE`);
    await admin.end();
  }
});

function schemaName(prefix) {
  return `tether_${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function poolFor(schema) {
  return new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
}

function storeFor(schema) {
  return new PostgresRelationshipStore(poolFor(schema));
}

function context(tenantId) {
  return { tenantId, actorId: "postgres-test-actor", scopes: ["model:write", "relationship:write", "relationship:read"], correlationId: `corr-${tenantId}` };
}

function fixedOptions(prefix) {
  let serial = 0;
  return {
    now: () => "2026-07-13T00:00:00.000Z",
    idGenerator: () => `${prefix}-${++serial}`
  };
}

function auditEvent(requestContext, id, resourceId) {
  return { id, tenantId: requestContext.tenantId, actorId: requestContext.actorId, action: "relationship.created", resourceId, correlationId: requestContext.correlationId, metadata: {}, createdAt: "2026-07-13T00:00:00.000Z" };
}

function outboxEvent(requestContext, id, resourceId) {
  return { id, tenantId: requestContext.tenantId, eventType: "tether.relationship.created.v1", resourceId, correlationId: requestContext.correlationId, payload: {}, createdAt: "2026-07-13T00:00:00.000Z" };
}
