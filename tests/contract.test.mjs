import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createRelationshipSchema,
  decayPreviewSchema,
  errorEnvelopeSchema,
  publicSchemas,
  relationshipEventSchema,
  relationshipModelSchema,
  responseEnvelopeSchema,
  simulateRelationshipEventSchema
} from "../dist/index.js";

test("TEST-CONTRACT-001 exports public JSON Schemas with stable ids", () => {
  const schemas = [
    relationshipModelSchema,
    createRelationshipSchema,
    relationshipEventSchema,
    simulateRelationshipEventSchema,
    decayPreviewSchema,
    responseEnvelopeSchema,
    errorEnvelopeSchema
  ];

  assert.deepEqual(Object.keys(publicSchemas).sort(), [
    "createRelationship",
    "decayPreview",
    "errorEnvelope",
    "relationshipEvent",
    "relationshipModel",
    "responseEnvelope",
    "simulateRelationshipEvent"
  ]);
  for (const schema of schemas) {
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.match(schema.$id, /^https:\/\/tuzuminami\.github\.io\/tether\/schemas\//);
  }
});

test("TEST-CONTRACT-002 OpenAPI covers protected primary routes and simulate", () => {
  const openapi = readFileSync(new URL("../openapi/openapi.yaml", import.meta.url), "utf8");
  for (const expected of [
    "/v1/models",
    "/v1/relationships",
    "/v1/relationships/{relationshipId}/events",
    "/v1/relationships/{relationshipId}/explanation",
    "/v1/relationships/{relationshipId}/simulate"
  ]) {
    assert.match(openapi, new RegExp(expected.replace(/[{}]/g, "\\$&")));
  }
  assert.match(openapi, /RelationshipModel:/);
  assert.match(openapi, /SimulateRelationshipEventRequest:/);
  assert.match(openapi, /ErrorEnvelope:/);
});
