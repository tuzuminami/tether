#!/usr/bin/env node
import { Readable } from "node:stream";
import { InMemoryRelationshipStore, RelationshipService, handleTetherHttpRequest } from "../dist/index.js";

const externalBaseUrl = process.env.TETHER_BASE_URL;
const runtime = externalBaseUrl === undefined ? { service: new RelationshipService(new InMemoryRelationshipStore()) } : undefined;
const authorization = externalBaseUrl === undefined ? "Bearer test-token" : process.env.TETHER_SMOKE_AUTHORIZATION;
if (authorization === undefined) throw new Error("TETHER_SMOKE_AUTHORIZATION is required when TETHER_BASE_URL is set.");
const testAuthenticator = {
  authenticate({ authorization: requestAuthorization, tenantId, correlationId }) {
    if (requestAuthorization !== "Bearer test-token" || tenantId === undefined) throw new Error("test authentication failed");
    return { tenantId, actorId: "test-actor", scopes: ["model:write", "relationship:write", "relationship:read"], correlationId };
  }
};

const headers = {
  authorization,
  "x-tenant-id": "tenant_smoke",
  "x-correlation-id": "corr_smoke",
  "content-type": "application/json"
};

await request("POST", "/v1/models", headers, {
  id: "smoke-model",
  version: "1.0.0",
  axes: [{ id: "trust", min: 0, max: 100, initial: 40 }],
  events: [{ type: "helpful_interaction" }],
  transitionRules: [
    { id: "trust-helpful", eventType: "helpful_interaction", axis: "trust", delta: 7, reasonCode: "HELPFUL" }
  ],
  boundaryRules: [],
  decayRules: [{ axis: "trust", perDay: 1 }]
});
await request("POST", "/v1/relationships", headers, {
  id: "rel_smoke",
  modelId: "smoke-model",
  modelVersion: "1.0.0",
  subjectRef: "subject_hash_smoke"
});
const applied = await request(
  "POST",
  "/v1/relationships/rel_smoke/events",
  { ...headers, "idempotency-key": "idem_smoke" },
  { id: "evt_smoke", type: "helpful_interaction", payload: { sourceRef: "message_hash_smoke" } }
);
if (applied.data.relationship.snapshot.values.trust !== 47) {
  throw new Error("unexpected applied trust value");
}

const simulated = await request("POST", "/v1/relationships/rel_smoke/simulate", headers, {
  event: { id: "evt_smoke_sim", type: "helpful_interaction" }
});
if (simulated.data.values.trust !== 54) {
  throw new Error("unexpected simulated trust value");
}

const explanation = await request("GET", "/v1/relationships/rel_smoke/explanation", headers);
if (explanation.data.eventId !== "evt_smoke") {
  throw new Error("simulate mutated latest explanation");
}

console.log("e2e smoke: ok");

async function request(method, path, headers, body) {
  if (externalBaseUrl === undefined) {
    return directRequest(method, path, headers, body);
  }
  const response = await fetch(`${externalBaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return json;
}

async function directRequest(method, url, headers, body) {
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
  await handleTetherHttpRequest(runtime.service, requestStream, response, testAuthenticator);
  const json = JSON.parse(Buffer.concat(response.chunks).toString("utf8"));
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${method} ${url} failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return json;
}
