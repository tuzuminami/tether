import { randomUUID } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type Server, type ServerResponse } from "node:http";
import { InMemoryRelationshipStore, RelationshipService } from "./relationship-engine.js";
import { TetherError } from "./errors.js";
import {
  createRelationshipSchema,
  decayPreviewSchema,
  relationshipEventSchema,
  relationshipModelSchema,
  simulateRelationshipEventSchema
} from "./schemas.js";
import { assertValidSchemaInput } from "./schema-validator.js";
import type { RequestContext, TetherErrorCode } from "./types.js";

const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

export interface TetherHttpServerOptions {
  store?: InMemoryRelationshipStore;
  service?: TetherHttpService;
  serviceOptions?: ConstructorParameters<typeof RelationshipService>[1];
  authenticator?: TetherAuthenticator;
  readiness?: TetherReadinessProbe;
}

export interface TetherHttpService {
  createModel(context: RequestContext, input: unknown): unknown | Promise<unknown>;
  createRelationship(context: RequestContext, input: unknown): unknown | Promise<unknown>;
  applyEvent(context: RequestContext, relationshipId: string, event: Record<string, unknown>, idempotencyKey: string | undefined): unknown | Promise<unknown>;
  getExplanation(context: RequestContext, relationshipId: string): unknown | Promise<unknown>;
  previewDecay(context: RequestContext, relationshipId: string, baselineAt: string): unknown | Promise<unknown>;
  simulateEvent(context: RequestContext, relationshipId: string, event: Record<string, unknown>): unknown | Promise<unknown>;
}

export interface TetherAuthenticationRequest {
  authorization?: string | undefined;
  tenantId?: string | undefined;
  correlationId: string;
}

export type TetherAuthenticationFailure = "invalid_credentials" | "tenant_context_denied";

/**
 * The only errors an authentication adapter should throw for an expected
 * request denial. Unclassified adapter errors are treated as a dependency
 * failure so they cannot be mistaken for an authorization decision.
 */
export class TetherAuthenticationError extends Error {
  readonly failure: TetherAuthenticationFailure;

  constructor(failure: TetherAuthenticationFailure, message: string) {
    super(message);
    this.name = "TetherAuthenticationError";
    this.failure = failure;
  }
}

export interface TetherAuthenticator {
  /**
   * Returns the verified request context. Throw `TetherAuthenticationError`
   * with `invalid_credentials` for missing or invalid credentials, or
   * `tenant_context_denied` when an authenticated identity cannot use the
   * requested tenant. Other adapter failures map to a 503 dependency error.
   */
  authenticate(request: TetherAuthenticationRequest): RequestContext | Promise<RequestContext>;
}

export interface TetherReadinessProbe {
  check(): void | Promise<void>;
}

type TetherRequest = AsyncIterable<Buffer | Uint8Array | string> & {
  method?: string | undefined;
  url?: string | undefined;
  headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
};

type TetherResponse = Pick<ServerResponse, "writeHead" | "end">;

type Route =
  | { name: "health"; params: Record<string, never> }
  | { name: "ready"; params: Record<string, never> }
  | { name: "createModel"; params: Record<string, never> }
  | { name: "createRelationship"; params: Record<string, never> }
  | { name: "applyEvent"; params: { relationshipId: string } }
  | { name: "explanation"; params: { relationshipId: string } }
  | { name: "decayPreview"; params: { relationshipId: string } }
  | { name: "simulate"; params: { relationshipId: string } }
  | { name: "notFound"; params: Record<string, never> };

export function createTetherHttpServer(options: TetherHttpServerOptions = {}): Server {
  const store = options.store ?? new InMemoryRelationshipStore();
  const service = options.service ?? new RelationshipService(store, options.serviceOptions);
  const authenticator = options.authenticator;
  if (authenticator === undefined) {
    throw new Error("createTetherHttpServer requires an authenticator.");
  }
  const readiness = options.readiness ?? alwaysReady;

  return createServer((request, response) => {
    void handleTetherHttpRequest(service, request, response, authenticator, readiness);
  });
}

export async function handleTetherHttpRequest(
  service: TetherHttpService,
  request: TetherRequest,
  response: TetherResponse,
  authenticator: TetherAuthenticator,
  readiness: TetherReadinessProbe = alwaysReady
): Promise<void> {
  const correlationId = headerValue(request.headers, "x-correlation-id") ?? `corr_${randomUUID()}`;
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const route = matchRoute(request.method ?? "GET", url.pathname);

    if (route.name === "health") {
      send(response, 200, { data: { status: "ok" }, meta: meta(correlationId) });
      return;
    }
    if (route.name === "ready") {
      try {
        await readiness.check();
      } catch {
        throw new TetherError("DEPENDENCY_UNAVAILABLE", "Runtime is not ready.", []);
      }
      send(response, 200, { data: { status: "ready" }, meta: meta(correlationId) });
      return;
    }
    const body = routeHasBody(route) ? await readJson(request) : undefined;
    const context = await authenticate(request, correlationId, authenticator);
    if (route.name === "createModel") {
      assertValidSchemaInput("RelationshipModel", relationshipModelSchema, body);
      const data = await service.createModel(context, body);
      send(response, 201, { data, meta: meta(correlationId) });
      return;
    }
    if (route.name === "createRelationship") {
      assertValidSchemaInput("CreateRelationshipRequest", createRelationshipSchema, body);
      const data = await service.createRelationship(context, body);
      send(response, 201, { data, meta: meta(correlationId) });
      return;
    }
    if (route.name === "applyEvent") {
      const idempotencyKey = headerValue(request.headers, "idempotency-key");
      if (!isRecord(body)) {
        throw new TetherError("VALIDATION_FAILED", "Request body must be a JSON object.", []);
      }
      assertValidSchemaInput("RelationshipEventRequest", relationshipEventSchema, body);
      const data = await service.applyEvent(context, route.params.relationshipId, body, idempotencyKey);
      send(response, 200, { data, meta: meta(correlationId) });
      return;
    }
    if (route.name === "explanation") {
      const data = await service.getExplanation(context, route.params.relationshipId);
      send(response, 200, { data, meta: meta(correlationId) });
      return;
    }
    if (route.name === "decayPreview") {
      assertValidSchemaInput("DecayPreviewRequest", decayPreviewSchema, body);
      if (!isRecord(body) || typeof body.baselineAt !== "string") {
        throw new TetherError("VALIDATION_FAILED", "baselineAt must be an ISO timestamp.", []);
      }
      const data = await service.previewDecay(context, route.params.relationshipId, body.baselineAt);
      send(response, 200, { data, meta: meta(correlationId) });
      return;
    }
    if (route.name === "simulate") {
      assertValidSchemaInput("SimulateRelationshipEventRequest", simulateRelationshipEventSchema, body);
      if (!isRecord(body) || !isRecord(body.event)) {
        throw new TetherError("VALIDATION_FAILED", "event must be a JSON object.", []);
      }
      const data = await service.simulateEvent(context, route.params.relationshipId, body.event);
      send(response, 200, { data, meta: meta(correlationId) });
      return;
    }

    sendError(response, correlationId, new TetherError("RESOURCE_NOT_FOUND", "Route was not found.", []));
  } catch (error) {
    sendError(response, correlationId, error);
  }
}

function routeHasBody(route: Route): boolean {
  return route.name === "createModel" || route.name === "createRelationship" || route.name === "applyEvent" || route.name === "decayPreview" || route.name === "simulate";
}

async function authenticate(request: TetherRequest, correlationId: string, authenticator: TetherAuthenticator): Promise<RequestContext> {
  const authorization = headerValue(request.headers, "authorization");
  const tenantId = headerValue(request.headers, "x-tenant-id");
  if (authorization === undefined || authorization.length === 0) {
    throw new TetherError("AUTHENTICATION_REQUIRED", "Authentication is required.", []);
  }
  if (tenantId === undefined || tenantId.length === 0) {
    throw new TetherError("TENANT_SCOPE_DENIED", "Request cannot access this resource.", []);
  }
  let context: unknown;
  try {
    context = await authenticator.authenticate({ authorization, tenantId, correlationId });
  } catch (error) {
    if (isAuthenticationFailure(error)) {
      throw new TetherError(
        error.failure === "invalid_credentials" ? "AUTHENTICATION_REQUIRED" : "TENANT_SCOPE_DENIED",
        error.failure === "invalid_credentials" ? "Authentication is required." : "Request cannot access this resource.",
        []
      );
    }
    throw new TetherError("DEPENDENCY_UNAVAILABLE", "Authentication adapter failed.", []);
  }
  if (!isVerifiedRequestContext(context, tenantId)) {
    throw new TetherError("TENANT_SCOPE_DENIED", "Request cannot access this resource.", []);
  }
  return context;
}

function matchRoute(method: string, pathname: string): Route {
  if (method === "GET" && pathname === "/health") {
    return { name: "health", params: {} };
  }
  if (method === "GET" && pathname === "/ready") {
    return { name: "ready", params: {} };
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
  const simulateMatch = pathname.match(/^\/v1\/relationships\/([^/]+)\/simulate$/);
  if (method === "POST" && simulateMatch?.[1] !== undefined) {
    return { name: "simulate", params: { relationshipId: decodeURIComponent(simulateMatch[1]) } };
  }
  return { name: "notFound", params: {} };
}

const alwaysReady: TetherReadinessProbe = {
  check() {}
};

async function readJson(request: TetherRequest): Promise<unknown> {
  const declaredLength = headerValue(request.headers, "content-length");
  if (declaredLength !== undefined && isRequestBodyTooLarge(declaredLength)) {
    throw new TetherError("REQUEST_BODY_TOO_LARGE", "Request body exceeds the 1 MiB limit.", []);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BODY_BYTES) {
      throw new TetherError("REQUEST_BODY_TOO_LARGE", "Request body exceeds the 1 MiB limit.", []);
    }
    chunks.push(buffer);
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

function isRequestBodyTooLarge(value: string): boolean {
  if (!/^[0-9]+$/.test(value)) return false;
  const length = Number(value);
  return Number.isSafeInteger(length) && length > MAX_REQUEST_BODY_BYTES;
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
      PLUGIN_INCOMPATIBLE: 422,
      REQUEST_BODY_TOO_LARGE: 413,
      DEPENDENCY_UNAVAILABLE: 503
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

function isVerifiedRequestContext(value: unknown, tenantId: string): value is RequestContext {
  return isRecord(value)
    && value.tenantId === tenantId
    && typeof value.actorId === "string"
    && value.actorId.length > 0
    && Array.isArray(value.scopes)
    && value.scopes.every((scope) => typeof scope === "string")
    && typeof value.correlationId === "string";
}

function isAuthenticationFailure(error: unknown): error is { failure: TetherAuthenticationFailure } {
  return isRecord(error) && (error.failure === "invalid_credentials" || error.failure === "tenant_context_denied");
}
