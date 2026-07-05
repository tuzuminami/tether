import { randomUUID } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type Server, type ServerResponse } from "node:http";
import { InMemoryRelationshipStore, RelationshipService, createDevelopmentContext } from "./relationship-engine.js";
import { TetherError } from "./errors.js";
import type { TetherErrorCode } from "./types.js";

export interface TetherHttpServerOptions {
  store?: InMemoryRelationshipStore;
  service?: RelationshipService;
  serviceOptions?: ConstructorParameters<typeof RelationshipService>[1];
}

type TetherRequest = AsyncIterable<Buffer | Uint8Array | string> & {
  method?: string | undefined;
  url?: string | undefined;
  headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
};

type TetherResponse = Pick<ServerResponse, "writeHead" | "end">;

type Route =
  | { name: "health"; params: Record<string, never> }
  | { name: "createModel"; params: Record<string, never> }
  | { name: "createRelationship"; params: Record<string, never> }
  | { name: "applyEvent"; params: { relationshipId: string } }
  | { name: "explanation"; params: { relationshipId: string } }
  | { name: "decayPreview"; params: { relationshipId: string } }
  | { name: "notFound"; params: Record<string, never> };

export function createTetherHttpServer(options: TetherHttpServerOptions = {}): Server {
  const store = options.store ?? new InMemoryRelationshipStore();
  const service = options.service ?? new RelationshipService(store, options.serviceOptions);

  return createServer((request, response) => {
    void handleTetherHttpRequest(service, request, response);
  });
}

export async function handleTetherHttpRequest(
  service: RelationshipService,
  request: TetherRequest,
  response: TetherResponse
): Promise<void> {
  const correlationId = headerValue(request.headers, "x-correlation-id") ?? `corr_${randomUUID()}`;
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const route = matchRoute(request.method ?? "GET", url.pathname);

    if (route.name === "health") {
      send(response, 200, { data: { status: "ok" }, meta: meta(correlationId) });
      return;
    }
    const context = authenticate(request, correlationId);
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
      const idempotencyKey = headerValue(request.headers, "idempotency-key");
      const body = await readJson(request);
      if (!isRecord(body)) {
        throw new TetherError("VALIDATION_FAILED", "Request body must be a JSON object.", []);
      }
      const data = service.applyEvent(context, route.params.relationshipId, body, idempotencyKey);
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
      if (!isRecord(body) || typeof body.baselineAt !== "string") {
        throw new TetherError("VALIDATION_FAILED", "baselineAt must be an ISO timestamp.", []);
      }
      const data = service.previewDecay(context, route.params.relationshipId, body.baselineAt);
      send(response, 200, { data, meta: meta(correlationId) });
      return;
    }

    sendError(response, correlationId, new TetherError("RESOURCE_NOT_FOUND", "Route was not found.", []));
  } catch (error) {
    sendError(response, correlationId, error);
  }
}

export function createDefaultApiRuntime(): { store: InMemoryRelationshipStore; service: RelationshipService; server: Server } {
  const store = new InMemoryRelationshipStore();
  const service = new RelationshipService(store);
  return { store, service, server: createTetherHttpServer({ store, service }) };
}

function authenticate(request: TetherRequest, correlationId: string) {
  const authorization = headerValue(request.headers, "authorization");
  const tenantId = headerValue(request.headers, "x-tenant-id");
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

function matchRoute(method: string, pathname: string): Route {
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

async function readJson(request: TetherRequest): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw.length === 0) {
    return {};
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new TetherError("VALIDATION_FAILED", "Request body must be valid JSON.", []);
  }
}

function send(response: TetherResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(body)}\n`);
}

function sendError(response: TetherResponse, correlationId: string, error: unknown): void {
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

function mapError(error: unknown): { status: number; code: TetherErrorCode; message: string; details: string[] } {
  if (error instanceof TetherError) {
    const statusByCode: Partial<Record<TetherErrorCode, number>> = {
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

function meta(correlationId: string): { requestId: string; correlationId: string; apiVersion: "v1" } {
  return {
    requestId: `req_${randomUUID()}`,
    correlationId,
    apiVersion: "v1"
  };
}

function headerValue(headers: TetherRequest["headers"], name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
