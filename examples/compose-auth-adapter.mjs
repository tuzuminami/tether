/** Local/CI smoke adapter mounted read-only by docker-compose.yml. Never use in production. */
import { TetherAuthenticationError } from "@tuzuminami/tether";

export function authenticateTetherRequest({ authorization, tenantId, correlationId }) {
  if (authorization !== "Bearer tether-compose-demo") {
    throw new TetherAuthenticationError("invalid_credentials", "Compose smoke credential is invalid.");
  }
  if (tenantId !== "tenant_smoke") {
    throw new TetherAuthenticationError("tenant_context_denied", "Compose smoke credential cannot access this tenant.");
  }
  return {
    tenantId: "tenant_smoke",
    actorId: "compose-smoke-actor",
    scopes: ["model:write", "relationship:write", "relationship:read"],
    correlationId
  };
}
