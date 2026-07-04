import { createServer } from "node:http";
import { InMemoryRelationshipStore, RelationshipService, createDevelopmentContext } from "./relationship-engine.js";
import { TetherError } from "./errors.js";

export function createTetherHttpServer(options = {}) {
  const store = options.store ?? new InMemoryRelationshipStore();
  const service = options.service ?? new RelationshipService(store, options.serviceOptions);

  return createServer(async (request, response) => {
    const correlationId = request.headers["x-correlation-id"]?.toString() ?? `corr_${crypto.randomUUID()}`;
    try {
      const context = authenticate(request, correlationId);
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const route = matchRoute(request.method ?? "GET", url.pathname);

      if (route.name === "health") {
        send(response, 200, { data: { status: "ok" }, meta: meta(correlationId) });
        return;
      }
      if (route.name === "createModel") {
        const data = service.createModel(context, await readJson(request));
        send(response, 201, { data, meta: meta(correlationId) });
        return;
      }
      if (route.name === "createRelationship") {
        const data = service.createRelationship(context, await readJson(request));
        send(response, 201, { data, meta: meta(correlationId) });
        return;
      }
      if (route.name === "applyEvent") {
        const idempotencyKey = request.headers["idempotency-key"]?.toString();
        const data = service.applyEvent(context, route.params.relationshipId, await readJson(request), idempotencyKey);
        send(response, 200, { data, meta: meta(correlationId) });
        return;
      }
      if (route.name === "explanation") {
        const data = service.getExplanation(context, route.params.relationshipId);
        send(response, 200, { data, meta: meta(correlationId) });
        return;
      }
      if (route.name === "decayPreview") {
        const body = await readJson(request);
        const data = service.previewDecay(context, route.params.relationshipId, body.baselineAt);
        send(response, 200, { data, meta: meta(correlationId) });
        return;
      }

      sendError(response, correlationId, new TetherError("RESOURCE_NOT_FOUND", "Route was not found.", []));
    } catch (error) {
      sendError(response, correlationId, error);
    }
  });
}

export function createDefaultApiRuntime() {
  const store = new InMemoryRelationshipStore();
  const service = new RelationshipService(store);
  return { store, service, server: createTetherHttpServer({ store, service }) };
}

function authenticate(request, correlationId) {
  const authorization = request.headers.authorization;
  const tenantId = request.headers["x-tenant-id"]?.toString();
  if (authorization !== "Bearer dev-token") {
    throw new TetherError("AUTHENTICATION_REQUIRED", "Authentication is required.", []);
  }
  if (tenantId === undefined || tenantId.length === 0) {
    throw new TetherError("TENANT_SCOPE_DENIED", "Request cannot access this resource.", []);
  }
  return createDevelopmentContext({
    tenantId,
    actorId: "dev-token-actor",
    correlationId
  });
}

function matchRoute(method, pathname) {
  if (method === "GET" && pathname === "/health") {
    return { name: "health", params: {} };
  }
  if (method === "POST" && pathname === "/v1/models") {
    return { name: "createModel", params: {} };
  }
  if (method === "POST" && pathname === "/v1/relationships") {
    return { name: "createRelationship", params: {} };
  }
  const eventMatch = pathname.match(/^\/v1\/relationships\/([^/]+)\/events$/);
  if (method === "POST" && eventMatch?.[1] !== undefined) {
    return { name: "applyEvent", params: { relationshipId: decodeURIComponent(eventMatch[1]) } };
  }
  const explanationMatch = pathname.match(/^\/v1\/relationships\/([^/]+)\/explanation$/);
  if (method === "GET" && explanationMatch?.[1] !== undefined) {
    return { name: "explanation", params: { relationshipId: decodeURIComponent(explanationMatch[1]) } };
  }
  const decayMatch = pathname.match(/^\/v1\/relationships\/([^/]+)\/decay-preview$/);
  if (method === "POST" && decayMatch?.[1] !== undefined) {
    return { name: "decayPreview", params: { relationshipId: decodeURIComponent(decayMatch[1]) } };
  }
  return { name: "notFound", params: {} };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw.length === 0) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new TetherError("VALIDATION_FAILED", "Request body must be valid JSON.", []);
  }
}

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(body)}\n`);
}

function sendError(response, correlationId, error) {
  const mapped = mapError(error);
  send(response, mapped.status, {
    error: {
      code: mapped.code,
      message: mapped.message,
      details: mapped.details,
      correlationId
    }
  });
}

function mapError(error) {
  if (error instanceof TetherError) {
    const statusByCode = {
      AUTHENTICATION_REQUIRED: 401,
      TENANT_SCOPE_DENIED: 403,
      RESOURCE_NOT_FOUND: 404,
      VALIDATION_FAILED: 422,
      VERSION_CONFLICT: 409,
      RESOURCE_IMMUTABLE: 409,
      IDEMPOTENCY_CONFLICT: 409,
      PLUGIN_INCOMPATIBLE: 422
    };
    return {
      status: statusByCode[error.code] ?? 500,
      code: error.code,
      message: error.message,
      details: error.details
    };
  }
  return {
    status: 500,
    code: "DEPENDENCY_UNAVAILABLE",
    message: "Unexpected server failure.",
    details: []
  };
}

function meta(correlationId) {
  return {
    requestId: `req_${crypto.randomUUID()}`,
    correlationId,
    apiVersion: "v1"
  };
}
