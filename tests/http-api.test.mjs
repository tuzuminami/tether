import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { InMemoryRelationshipStore, RelationshipService, handleTetherHttpRequest } from "../dist/index.js";

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
    authorization: "Bearer dev-token",
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
    authorization: "Bearer dev-token",
    "x-tenant-id": "other_tenant"
  });
  assert.equal(denied.status, 404);
});

test("TEST-API-002 missing auth fails closed", async () => {
  const response = await request(createService(), "POST", "/v1/models", {}, model);
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, "AUTHENTICATION_REQUIRED");
});

test("TEST-API-003 health is public but protected APIs still require auth", async () => {
  const service = createService();
  const health = await request(service, "GET", "/health", {});
  assert.equal(health.status, 200);
  assert.equal(health.body.data.status, "ok");

  const protectedResponse = await request(service, "POST", "/v1/relationships", {}, {});
  assert.equal(protectedResponse.status, 401);
});

test("TEST-API-004 rejects schema-invalid request bodies before domain execution", async () => {
  const service = createService();
  const headers = {
    authorization: "Bearer dev-token",
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

function createService() {
  return new RelationshipService(new InMemoryRelationshipStore());
}

async function request(service, method, url, headers, body) {
  const requestBody = body === undefined ? "" : JSON.stringify(body);
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
  await handleTetherHttpRequest(service, requestStream, response);
  return {
    status: response.status,
    body: JSON.parse(Buffer.concat(response.chunks).toString("utf8"))
  };
}
