import assert from "node:assert/strict";
import test from "node:test";
import { TetherAuthenticationError } from "../dist/index.js";
import { authenticateTetherRequest } from "../examples/compose-auth-adapter.mjs";

test("TEST-COMPOSE-AUTH-001 fixes the demo credential to its documented tenant", () => {
  assert.deepEqual(
    authenticateTetherRequest({ authorization: "Bearer tether-compose-demo", tenantId: "tenant_smoke", correlationId: "corr-compose" }),
    { tenantId: "tenant_smoke", actorId: "compose-smoke-actor", scopes: ["model:write", "relationship:write", "relationship:read"], correlationId: "corr-compose" }
  );
  assert.throws(
    () => authenticateTetherRequest({ authorization: "Bearer tether-compose-demo", tenantId: "another-tenant", correlationId: "corr-compose" }),
    (error) => error instanceof TetherAuthenticationError && error.failure === "tenant_context_denied"
  );
  assert.throws(
    () => authenticateTetherRequest({ authorization: "Bearer invalid", tenantId: "tenant_smoke", correlationId: "corr-compose" }),
    (error) => error instanceof TetherAuthenticationError && error.failure === "invalid_credentials"
  );
});
