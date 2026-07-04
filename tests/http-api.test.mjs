import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultApiRuntime } from "../dist/index.js";

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
  const runtime = createDefaultApiRuntime();
  await new Promise((resolve) => runtime.server.listen(0, "127.0.0.1", resolve));
  const address = runtime.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const headers = {
    authorization: "Bearer dev-token",
    "x-tenant-id": "tenant_api",
    "x-correlation-id": "corr_api",
    "content-type": "application/json"
  };

  try {
    assert.equal((await request(baseUrl, "POST", "/v1/models", headers, model)).status, 201);
    assert.equal(
      (
        await request(baseUrl, "POST", "/v1/relationships", headers, {
          id: "rel_api",
          modelId: "api-model",
          modelVersion: "1.0.0",
          subjectRef: "subject_hash"
        })
      ).status,
      201
    );
    const event = await request(
      baseUrl,
      "POST",
      "/v1/relationships/rel_api/events",
      { ...headers, "idempotency-key": "idem_api" },
      { id: "evt_api", type: "helpful_interaction" }
    );
    assert.equal(event.status, 200);
    assert.equal(event.body.data.relationship.snapshot.values.trust, 15);

    const replay = await request(
      baseUrl,
      "POST",
      "/v1/relationships/rel_api/events",
      { ...headers, "idempotency-key": "idem_api" },
      { id: "evt_api", type: "helpful_interaction" }
    );
    assert.equal(replay.body.data.relationship.snapshot.version, 2);

    const denied = await request(baseUrl, "GET", "/v1/relationships/rel_api/explanation", {
      authorization: "Bearer dev-token",
      "x-tenant-id": "other_tenant"
    });
    assert.equal(denied.status, 404);
  } finally {
    await new Promise((resolve) => runtime.server.close(resolve));
  }
});

test("TEST-API-002 missing auth fails closed", async () => {
  const runtime = createDefaultApiRuntime();
  await new Promise((resolve) => runtime.server.listen(0, "127.0.0.1", resolve));
  const address = runtime.server.address();
  try {
    const response = await request(`http://127.0.0.1:${address.port}`, "POST", "/v1/models", {}, model);
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, "AUTHENTICATION_REQUIRED");
  } finally {
    await new Promise((resolve) => runtime.server.close(resolve));
  }
});

async function request(baseUrl, method, path, headers, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}
