import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { TetherAuthenticationError, createConfiguredApiRuntime } from "../dist/index.js";

const databaseUrl = process.env.TETHER_TEST_DATABASE_URL;
const integration = databaseUrl === undefined ? test.skip : test;
const model = {
  id: "http-runtime-model",
  version: "1.0.0",
  axes: [{ id: "trust", min: 0, max: 100, initial: 10 }],
  events: [{ type: "helpful_interaction" }],
  transitionRules: [{ id: "trust-helpful", eventType: "helpful_interaction", axis: "trust", delta: 5, reasonCode: "HELPFUL" }],
  boundaryRules: [],
  decayRules: []
};

integration("TEST-PG-HTTP-001 proves PostgreSQL HTTP runtime auth, restart, isolation, idempotency, audit/outbox, and failure behavior", { concurrency: false }, async () => {
  const schema = `tether_http_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: databaseUrl });
  const scopedDatabaseUrl = databaseUrlForSchema(databaseUrl, schema);
  let first;
  let second;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    first = await createRuntime(scopedDatabaseUrl);
    const firstBaseUrl = await listen(first.server);

    assert.equal((await request(firstBaseUrl, "GET", "/health")).status, 200);
    const missingCredential = await request(firstBaseUrl, "POST", "/v1/models", { body: model });
    assert.equal(missingCredential.status, 401);
    assert.equal(missingCredential.body.error.code, "AUTHENTICATION_REQUIRED");
    const invalidCredential = await request(firstBaseUrl, "POST", "/v1/models", { token: "Bearer invalid", tenantId: "tenant-a", body: model });
    assert.equal(invalidCredential.status, 401);
    assert.equal(invalidCredential.body.error.code, "AUTHENTICATION_REQUIRED");
    const tenantMismatch = await request(firstBaseUrl, "POST", "/v1/models", { token: "Bearer tenant-a", tenantId: "tenant-b", body: model });
    assert.equal(tenantMismatch.status, 403);
    assert.equal(tenantMismatch.body.error.code, "TENANT_SCOPE_DENIED");

    assert.equal((await request(firstBaseUrl, "POST", "/v1/models", { token: "Bearer tenant-a", tenantId: "tenant-a", body: model })).status, 201);
    const created = await request(firstBaseUrl, "POST", "/v1/relationships", {
      token: "Bearer tenant-a", tenantId: "tenant-a", body: { id: "http-runtime-relationship", modelId: model.id, modelVersion: model.version, subjectRef: "subject-a" }
    });
    assert.equal(created.status, 201);

    const eventOptions = { token: "Bearer tenant-a", tenantId: "tenant-a", idempotencyKey: "http-runtime-idem", body: { id: "http-runtime-event", type: "helpful_interaction" } };
    const applied = await request(firstBaseUrl, "POST", "/v1/relationships/http-runtime-relationship/events", eventOptions);
    const replay = await request(firstBaseUrl, "POST", "/v1/relationships/http-runtime-relationship/events", eventOptions);
    assert.equal(applied.status, 200);
    assert.deepEqual(replay.body.data, applied.body.data);
    assert.equal((await request(firstBaseUrl, "GET", "/v1/relationships/http-runtime-relationship/explanation", { token: "Bearer tenant-b", tenantId: "tenant-b" })).status, 404);
    assert.equal((await request(firstBaseUrl, "POST", "/v1/relationships/http-runtime-relationship/events", { token: "Bearer tenant-a", tenantId: "tenant-a", idempotencyKey: "http-runtime-idem", body: { id: "different-event", type: "helpful_interaction" } })).status, 409);
    assert.equal((await request(firstBaseUrl, "POST", "/v1/relationships/http-runtime-relationship/events", { token: "Bearer tenant-a", tenantId: "tenant-a", idempotencyKey: "failed-event", body: { id: "invalid-event", type: "unknown" } })).status, 422);

    const verificationPool = new Pool({ connectionString: scopedDatabaseUrl });
    try {
      const sideEffects = await verificationPool.query(
        "SELECT (SELECT count(*)::int FROM tether_audit_events WHERE tenant_id = $1 AND resource_id = $2 AND action = 'relationship.event_applied') AS audits, (SELECT count(*)::int FROM tether_outbox_events WHERE tenant_id = $1 AND resource_id = $2 AND event_type = 'tether.relationship.event-applied.v1') AS outbox",
        ["tenant-a", "http-runtime-relationship"]
      );
      assert.deepEqual(sideEffects.rows[0], { audits: 1, outbox: 1 });
    } finally {
      await verificationPool.end();
    }

    await closeRuntime(first);
    first = undefined;
    second = await createRuntime(scopedDatabaseUrl);
    const secondBaseUrl = await listen(second.server);
    const persisted = await request(secondBaseUrl, "GET", "/v1/relationships/http-runtime-relationship/explanation", { token: "Bearer tenant-a", tenantId: "tenant-a" });
    assert.equal(persisted.status, 200);
    assert.equal(persisted.body.data.eventId, "http-runtime-event");
    assert.equal((await request(secondBaseUrl, "POST", "/v1/relationships/http-runtime-relationship/events", eventOptions)).body.data.relationship.snapshot.version, 2);
  } finally {
    await Promise.allSettled([first === undefined ? undefined : closeRuntime(first), second === undefined ? undefined : closeRuntime(second)]);
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});

async function createRuntime(databaseUrl) {
  return createConfiguredApiRuntime({
    env: { TETHER_RUNTIME_STORE: "postgres", TETHER_BIND_HOST: "127.0.0.1", TETHER_MIGRATE_POSTGRES: "1", DATABASE_URL: databaseUrl, TETHER_AUTH_ADAPTER: "injected-e2e-auth" },
    async loadAuthenticator() {
      return { authenticate({ authorization, tenantId, correlationId }) {
        const authenticatedTenant = authorization === "Bearer tenant-a" ? "tenant-a" : authorization === "Bearer tenant-b" ? "tenant-b" : undefined;
        if (authenticatedTenant === undefined) {
          throw new TetherAuthenticationError("invalid_credentials", "E2E credential is invalid.");
        }
        if (tenantId !== authenticatedTenant) {
          throw new TetherAuthenticationError("tenant_context_denied", "E2E credential cannot access this tenant.");
        }
        return { tenantId: authenticatedTenant, actorId: `${authenticatedTenant}-actor`, scopes: ["model:write", "relationship:write", "relationship:read"], correlationId };
      } };
    }
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  return `http://127.0.0.1:${address.port}`;
}

async function closeRuntime(runtime) {
  await new Promise((resolve, reject) => runtime.server.close((error) => error === undefined ? resolve() : reject(error)));
  await runtime.store.close();
}

async function request(baseUrl, method, path, options = {}) {
  const headers = { ...(options.token === undefined ? {} : { authorization: options.token }), ...(options.tenantId === undefined ? {} : { "x-tenant-id": options.tenantId }), ...(options.idempotencyKey === undefined ? {} : { "idempotency-key": options.idempotencyKey }), ...(options.body === undefined ? {} : { "content-type": "application/json" }) };
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  return { status: response.status, body: await response.json() };
}

function databaseUrlForSchema(value, schema) {
  const url = new URL(value);
  url.searchParams.set("options", `-c search_path=${schema}`);
  return url.toString();
}
