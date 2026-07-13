import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import {
  InMemoryRelationshipStore,
  RelationshipService,
  TetherAuthenticationError,
  createTetherHttpServer,
  handleTetherHttpRequest
} from "../dist/index.js";

const testAuthenticator = {
  authenticate({ authorization, tenantId, correlationId }) {
    if (authorization !== "Bearer test-token" || tenantId === undefined) {
      throw new TetherAuthenticationError("invalid_credentials", "Test credential is invalid.");
    }
    return { tenantId, actorId: "test-actor", scopes: ["model:write", "relationship:write", "relationship:read"], correlationId };
  }
};

const model = {
  id: "api-model",
  version: "1.0.0",
  axes: [{ id: "trust", min: 0, max: 100, initial: 10 }],
  events: [{ type: "helpful_interaction" }],
  transitionRules: [
    { id: "trust-helpful", eventType: "helpful_interaction", axis: "trust", delta: 5, reasonCode: "HELPFUL" }
  ],
  boundaryRules: [],
  decayRules: []
};

test("TEST-API-001 runs primary flow through HTTP envelopes", async () => {
  const service = createService();
  const headers = {
    authorization: "Bearer test-token",
    "x-tenant-id": "tenant_api",
    "x-correlation-id": "corr_api",
    "content-type": "application/json"
  };

  assert.equal((await request(service, "POST", "/v1/models", headers, model)).status, 201);
  assert.equal(
    (
      await request(service, "POST", "/v1/relationships", headers, {
        id: "rel_api",
        modelId: "api-model",
        modelVersion: "1.0.0",
        subjectRef: "subject_hash"
      })
    ).status,
    201
  );
  const event = await request(service, "POST", "/v1/relationships/rel_api/events", { ...headers, "idempotency-key": "idem_api" }, { id: "evt_api", type: "helpful_interaction" });
  assert.equal(event.status, 200);
  assert.equal(event.body.data.relationship.snapshot.values.trust, 15);

  const replay = await request(service, "POST", "/v1/relationships/rel_api/events", { ...headers, "idempotency-key": "idem_api" }, { id: "evt_api", type: "helpful_interaction" });
  assert.equal(replay.body.data.relationship.snapshot.version, 2);

  const simulated = await request(service, "POST", "/v1/relationships/rel_api/simulate", headers, {
    event: { id: "evt_sim", type: "helpful_interaction" }
  });
  assert.equal(simulated.status, 200);
  assert.equal(simulated.body.data.values.trust, 20);
  assert.equal(simulated.body.data.fromSnapshotVersion, 2);
  assert.equal(simulated.body.data.projectedSnapshotVersion, 3);

  const afterSimulation = await request(service, "GET", "/v1/relationships/rel_api/explanation", headers);
  assert.equal(afterSimulation.body.data.eventId, "evt_api");
  assert.equal(afterSimulation.body.data.snapshotVersion, 2);

  const denied = await request(service, "GET", "/v1/relationships/rel_api/explanation", {
    authorization: "Bearer test-token",
    "x-tenant-id": "other_tenant"
  });
  assert.equal(denied.status, 404);
});

test("TEST-API-002 missing auth fails closed", async () => {
  const response = await request(createService(), "POST", "/v1/models", {}, model);
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, "AUTHENTICATION_REQUIRED");
});

test("TEST-API-003 health is public liveness while ready runs the public readiness probe", async () => {
  const service = createService();
  const health = await request(service, "GET", "/health", {});
  assert.equal(health.status, 200);
  assert.equal(health.body.data.status, "ok");

  const ready = await request(service, "GET", "/ready", {}, undefined, undefined, { check() {} });
  assert.equal(ready.status, 200);
  assert.equal(ready.body.data.status, "ready");

  const unavailable = await request(service, "GET", "/ready", {}, undefined, undefined, { check() { throw new Error("database unavailable"); } });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.error.code, "DEPENDENCY_UNAVAILABLE");

  const protectedResponse = await request(service, "POST", "/v1/relationships", {}, {});
  assert.equal(protectedResponse.status, 401);
});

test("TEST-API-004 rejects schema-invalid request bodies before domain execution", async () => {
  const service = createService();
  const headers = {
    authorization: "Bearer test-token",
    "x-tenant-id": "tenant_api",
    "content-type": "application/json"
  };

  const modelWithExtraField = await request(service, "POST", "/v1/models", headers, { ...model, prompt: "private text" });
  assert.equal(modelWithExtraField.status, 422);
  assert.equal(modelWithExtraField.body.error.code, "VALIDATION_FAILED");
  assert.equal(modelWithExtraField.body.error.details.some((detail) => detail.includes("$.prompt")), true);

  assert.equal((await request(service, "POST", "/v1/models", headers, model)).status, 201);
  const relationshipWithExtraField = await request(service, "POST", "/v1/relationships", headers, {
    modelId: "api-model",
    modelVersion: "1.0.0",
    subjectRef: "subject_hash",
    rawUserName: "not allowed"
  });
  assert.equal(relationshipWithExtraField.status, 422);
  assert.equal(relationshipWithExtraField.body.error.details.some((detail) => detail.includes("$.rawUserName")), true);
});

test("TEST-API-005 rejects an auth adapter context that does not match the requested tenant", async () => {
  const response = await request(
    createService(),
    "POST",
    "/v1/models",
    { authorization: "Bearer verified", "x-tenant-id": "tenant_api", "content-type": "application/json" },
    model,
    { authenticate: () => ({ tenantId: "other_tenant", actorId: "actor_verified", scopes: ["model:write"], correlationId: "corr_verified" }) }
  );
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "TENANT_SCOPE_DENIED");
});

test("TEST-API-006 public HTTP entrypoints require an explicit authenticator", async () => {
  assert.throws(() => createTetherHttpServer(), /requires an authenticator/);
  const server = createTetherHttpServer({ authenticator: testAuthenticator });
  server.close();
});

test("TEST-API-007 rejects oversized declared, chunked, and spoofed request bodies before authentication", async () => {
  const oversized = "x".repeat(1024 * 1024 + 1);
  const neverAuthenticate = { authenticate: () => { throw new Error("authentication must not run for oversized requests"); } };
  const headers = { authorization: "Bearer test-token", "x-tenant-id": "tenant_api", "content-type": "application/json" };

  for (const requestHeaders of [
    { ...headers, "content-length": String(1024 * 1024 + 1) },
    headers,
    { ...headers, "content-length": "1" }
  ]) {
    const response = await requestRaw(createService(), "POST", "/v1/models", requestHeaders, oversized, neverAuthenticate);
    assert.equal(response.status, 413);
    assert.equal(response.body.error.code, "REQUEST_BODY_TOO_LARGE");
  }
});

test("TEST-API-008 maps typed adapter denials through the direct HTTP server", async (t) => {
  const server = createTetherHttpServer({
    service: createService(),
    authenticator: {
      authenticate({ authorization, tenantId, correlationId }) {
        if (authorization !== "Bearer verified") {
          throw new TetherAuthenticationError("invalid_credentials", "Credential verification failed.");
        }
        if (tenantId !== "tenant_verified") {
          throw new TetherAuthenticationError("tenant_context_denied", "Verified credential cannot access this tenant.");
        }
        return { tenantId, actorId: "verified-actor", scopes: ["model:write"], correlationId };
      }
    }
  });
  const baseUrl = await listen(server);
  t.after(() => new Promise((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error))));

  const invalidCredential = await fetch(`${baseUrl}/v1/models`, {
    method: "POST",
    headers: { authorization: "Bearer invalid", "x-tenant-id": "tenant_verified", "content-type": "application/json" },
    body: JSON.stringify(model)
  });
  assert.equal(invalidCredential.status, 401);
  assert.equal((await invalidCredential.json()).error.code, "AUTHENTICATION_REQUIRED");

  const tenantMismatch = await fetch(`${baseUrl}/v1/models`, {
    method: "POST",
    headers: { authorization: "Bearer verified", "x-tenant-id": "other_tenant", "content-type": "application/json" },
    body: JSON.stringify(model)
  });
  assert.equal(tenantMismatch.status, 403);
  assert.equal((await tenantMismatch.json()).error.code, "TENANT_SCOPE_DENIED");
});

test("TEST-API-009 maps unclassified adapter failures to a dependency error", async () => {
  const response = await request(
    createService(),
    "POST",
    "/v1/models",
    { authorization: "Bearer verified", "x-tenant-id": "tenant_api", "content-type": "application/json" },
    model,
    { authenticate: () => { throw new Error("adapter transport failed"); } }
  );
  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, "DEPENDENCY_UNAVAILABLE");
});

test("TEST-API-010 maps a typed adapter failure by its stable discriminator", async () => {
  const response = await request(
    createService(),
    "POST",
    "/v1/models",
    { authorization: "Bearer invalid", "x-tenant-id": "tenant_api", "content-type": "application/json" },
    model,
    { authenticate: () => { throw { failure: "invalid_credentials" }; } }
  );
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, "AUTHENTICATION_REQUIRED");
});

function createService() {
  return new RelationshipService(new InMemoryRelationshipStore());
}

async function request(service, method, url, headers, body, authenticator, readiness) {
  const requestBody = body === undefined ? "" : JSON.stringify(body);
  return requestRaw(service, method, url, headers, requestBody, authenticator, readiness);
}

async function requestRaw(service, method, url, headers, requestBody, authenticator, readiness) {
  const requestStream = Readable.from(requestBody.length === 0 ? [] : [Buffer.from(requestBody)]);
  Object.assign(requestStream, { method, url, headers });

  const response = {
    status: 0,
    chunks: [],
    writeHead(status) {
      this.status = status;
    },
    end(chunk) {
      if (chunk !== undefined) {
        this.chunks.push(Buffer.from(chunk));
      }
    }
  };
  await handleTetherHttpRequest(service, requestStream, response, authenticator ?? testAuthenticator, readiness);
  return {
    status: response.status,
    body: JSON.parse(Buffer.concat(response.chunks).toString("utf8"))
  };
}

async function listen(server) {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  return `http://127.0.0.1:${address.port}`;
}
