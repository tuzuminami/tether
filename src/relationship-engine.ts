import { randomUUID } from "node:crypto";
import { canonicalJson, sha256Hex } from "./canonical-json.js";
import { TetherError } from "./errors.js";
import { parseRelationshipModel } from "./relationship-model.js";
import type {
  ApplyEventResult,
  AuditEvent,
  DecayPreview,
  IdempotencyEntry,
  OutboxEvent,
  RelationshipEventInput,
  RelationshipExplanation,
  RelationshipExplanationWarning,
  RelationshipRecord,
  RequestContext,
  StoredRelationshipModel,
  TetherScope
} from "./types.js";

export interface RelationshipServiceOptions {
  now?: () => string;
  idGenerator?: () => string;
}

export class InMemoryRelationshipStore {
  readonly models = new Map<string, StoredRelationshipModel>();
  readonly relationships = new Map<string, RelationshipRecord>();
  readonly idempotency = new Map<string, IdempotencyEntry<ApplyEventResult>>();
  readonly auditEvents: AuditEvent[] = [];
  readonly outboxEvents: OutboxEvent[] = [];

  modelKey(tenantId: string, modelId: string, modelVersion: string): string {
    return `${tenantId}:${modelId}:${modelVersion}`;
  }

  relationshipKey(tenantId: string, relationshipId: string): string {
    return `${tenantId}:${relationshipId}`;
  }
}

export class RelationshipService {
  private readonly store: InMemoryRelationshipStore;
  private readonly now: () => string;
  private readonly idGenerator: () => string;

  constructor(store: InMemoryRelationshipStore, options: RelationshipServiceOptions = {}) {
    this.store = store;
    this.now = options.now ?? (() => new Date().toISOString());
    this.idGenerator = options.idGenerator ?? (() => randomUUID());
  }

  createModel(context: RequestContext, input: unknown): StoredRelationshipModel {
    requireScope(context, "model:write");
    const model = parseRelationshipModel(input);
    const now = this.now();
    const key = this.store.modelKey(context.tenantId, model.id, model.version);
    if (this.store.models.has(key)) {
      throw new TetherError("RESOURCE_IMMUTABLE", "Relationship model version already exists.", [
        "published model versions are immutable"
      ]);
    }
    const record: StoredRelationshipModel = {
      ...model,
      tenantId: context.tenantId,
      createdAt: now,
      createdBy: context.actorId,
      resourceVersion: 1
    };
    this.store.models.set(key, record);
    this.appendAudit(context, "relationship_model.created", model.id, { modelVersion: model.version });
    return record;
  }

  createRelationship(context: RequestContext, input: unknown): RelationshipRecord {
    requireScope(context, "relationship:write");
    const modelId = readRequiredInputString(input, "modelId");
    const modelVersion = readRequiredInputString(input, "modelVersion");
    const subjectRef = readRequiredInputString(input, "subjectRef");
    const model = this.getModel(context, modelId, modelVersion);
    const now = this.now();
    const values = Object.fromEntries(model.axes.map((axis) => [axis.id, axis.initial]));
    const relationshipId = readInputString(input, "id") ?? this.idGenerator();
    const key = this.store.relationshipKey(context.tenantId, relationshipId);
    if (this.store.relationships.has(key)) {
      throw new TetherError("RESOURCE_IMMUTABLE", "Relationship already exists.", [
        "relationship ids are immutable within a tenant"
      ]);
    }
    const relationship: RelationshipRecord = {
      id: relationshipId,
      tenantId: context.tenantId,
      subjectRef,
      modelId: model.id,
      modelVersion: model.version,
      snapshot: {
        version: 1,
        values,
        modelId: model.id,
        modelVersion: model.version,
        updatedAt: now
      },
      explanations: [],
      createdAt: now,
      createdBy: context.actorId,
      updatedAt: now
    };
    this.store.relationships.set(key, relationship);
    this.appendAudit(context, "relationship.created", relationship.id, { modelId: model.id, modelVersion: model.version });
    this.appendOutbox(context, "tether.relationship.created.v1", relationship.id, { snapshotVersion: 1 });
    return relationship;
  }

  applyEvent(
    context: RequestContext,
    relationshipId: string,
    event: RelationshipEventInput,
    idempotencyKey: string | undefined
  ): ApplyEventResult {
    requireScope(context, "relationship:write");
    if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
      throw new TetherError("VALIDATION_FAILED", "Idempotency key is required.", ["idempotencyKey must be non-empty"]);
    }
    const idempotencyScope = `${context.tenantId}:${relationshipId}:${idempotencyKey}`;
    const requestHash = sha256Hex(canonicalJson({ relationshipId, event }));
    const existing = this.store.idempotency.get(idempotencyScope);
    if (existing !== undefined) {
      if (existing.requestHash !== requestHash) {
        throw new TetherError("IDEMPOTENCY_CONFLICT", "Idempotency key was reused with a different request.", []);
      }
      return existing.result;
    }

    const relationship = this.getRelationship(context, relationshipId);
    const model = this.getModel(context, relationship.modelId, relationship.modelVersion);
    const eventType = readInputString(event, "type");
    const eventId = readInputString(event, "id") ?? this.idGenerator();
    if (eventType === undefined || !model.events.some((declaredEvent) => declaredEvent.type === eventType)) {
      throw new TetherError("VALIDATION_FAILED", "Relationship event validation failed.", [
        `event type ${eventType ?? "<missing>"} is not declared by the model`
      ]);
    }

    const before = { ...relationship.snapshot.values };
    const matchingRules = model.transitionRules.filter((rule) => rule.eventType === eventType);
    const appliedRules: string[] = [];
    const warnings: RelationshipExplanationWarning[] = [];
    const after = { ...before };

    for (const rule of matchingRules) {
      const axis = model.axes.find((candidate) => candidate.id === rule.axis);
      if (axis === undefined) {
        throw new TetherError("VALIDATION_FAILED", "Transition rule references an unknown axis.", [rule.axis]);
      }
      const boundary = model.boundaryRules.find(
        (candidate) => candidate.eventType === eventType && candidate.axis === rule.axis && candidate.blocksPositiveDelta
      );
      if (boundary !== undefined && rule.delta > 0) {
        warnings.push({ boundaryRuleId: boundary.id, policyRef: boundary.policyRef, reasonCode: "BOUNDARY_BLOCKED" });
        continue;
      }
      after[rule.axis] = clamp((after[rule.axis] ?? axis.initial) + rule.delta, axis.min, axis.max);
      appliedRules.push(rule.id);
    }

    const createdAt = this.now();
    const explanation: RelationshipExplanation = {
      id: this.idGenerator(),
      relationshipId,
      snapshotVersion: relationship.snapshot.version + 1,
      eventId,
      eventType,
      eventHash: sha256Hex(canonicalJson({ id: eventId, type: eventType, payload: event.payload ?? null })),
      ruleIds: appliedRules,
      before,
      after,
      warnings,
      reasonCode: appliedRules.length > 0 ? "TRANSITION_APPLIED" : "NO_TRANSITION_APPLIED",
      createdAt
    };

    relationship.snapshot = {
      version: relationship.snapshot.version + 1,
      values: after,
      modelId: model.id,
      modelVersion: model.version,
      updatedAt: createdAt
    };
    relationship.updatedAt = createdAt;
    relationship.explanations = [...relationship.explanations, explanation];

    this.appendAudit(context, "relationship.event_applied", relationshipId, {
      snapshotVersion: relationship.snapshot.version,
      eventType,
      eventHash: explanation.eventHash
    });
    this.appendOutbox(context, "tether.relationship.event-applied.v1", relationshipId, {
      snapshotVersion: relationship.snapshot.version,
      eventType
    });

    const result = { relationship, explanation };
    this.store.idempotency.set(idempotencyScope, { requestHash, result });
    return result;
  }

  getExplanation(context: RequestContext, relationshipId: string): RelationshipExplanation | null {
    requireScope(context, "relationship:read");
    const relationship = this.getRelationship(context, relationshipId);
    return relationship.explanations.at(-1) ?? null;
  }

  previewDecay(context: RequestContext, relationshipId: string, baselineAt: string): DecayPreview {
    requireScope(context, "relationship:read");
    const relationship = this.getRelationship(context, relationshipId);
    const model = this.getModel(context, relationship.modelId, relationship.modelVersion);
    const elapsedMs = Date.parse(baselineAt) - Date.parse(relationship.snapshot.updatedAt);
    if (!Number.isFinite(elapsedMs)) {
      throw new TetherError("VALIDATION_FAILED", "baselineAt must be an ISO timestamp.", []);
    }
    const elapsedDays = Math.max(0, elapsedMs / 86_400_000);
    const values = { ...relationship.snapshot.values };
    for (const rule of model.decayRules) {
      const axis = model.axes.find((candidate) => candidate.id === rule.axis);
      if (axis === undefined) {
        continue;
      }
      const current = values[rule.axis] ?? axis.initial;
      const direction = current > axis.initial ? -1 : current < axis.initial ? 1 : 0;
      const next = current + direction * Math.min(Math.abs(current - axis.initial), rule.perDay * elapsedDays);
      values[rule.axis] = clamp(next, axis.min, axis.max);
    }
    return {
      relationshipId,
      baselineAt,
      fromSnapshotVersion: relationship.snapshot.version,
      values
    };
  }

  getModel(context: RequestContext, modelId: string, modelVersion: string): StoredRelationshipModel {
    const model = this.store.models.get(this.store.modelKey(context.tenantId, modelId, modelVersion));
    if (model === undefined) {
      throw new TetherError("RESOURCE_NOT_FOUND", "Resource was not found.", []);
    }
    return model;
  }

  getRelationship(context: RequestContext, relationshipId: string): RelationshipRecord {
    const relationship = this.store.relationships.get(this.store.relationshipKey(context.tenantId, relationshipId));
    if (relationship === undefined) {
      throw new TetherError("RESOURCE_NOT_FOUND", "Resource was not found.", []);
    }
    return relationship;
  }

  private appendAudit(context: RequestContext, action: string, resourceId: string, metadata: Record<string, unknown>): void {
    this.store.auditEvents.push({
      id: this.idGenerator(),
      tenantId: context.tenantId,
      actorId: context.actorId,
      action,
      resourceId,
      correlationId: context.correlationId,
      metadata,
      createdAt: this.now()
    });
  }

  private appendOutbox(context: RequestContext, eventType: string, resourceId: string, payload: Record<string, unknown>): void {
    this.store.outboxEvents.push({
      id: this.idGenerator(),
      tenantId: context.tenantId,
      eventType,
      resourceId,
      correlationId: context.correlationId,
      payload,
      createdAt: this.now()
    });
  }
}

export function createDevelopmentContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    tenantId: "tenant_demo",
    actorId: "actor_demo",
    scopes: ["model:write", "relationship:write", "relationship:read"],
    correlationId: "corr_demo",
    ...overrides
  };
}

function requireScope(context: RequestContext | undefined, scope: TetherScope): void {
  if (context === undefined || typeof context.tenantId !== "string" || typeof context.actorId !== "string") {
    throw new TetherError("AUTHENTICATION_REQUIRED", "Authentication is required.", []);
  }
  if (!Array.isArray(context.scopes) || !context.scopes.includes(scope)) {
    throw new TetherError("TENANT_SCOPE_DENIED", "Request cannot access this resource.", []);
  }
}

function readInputString(input: unknown, key: string): string | undefined {
  if (!isRecord(input)) {
    throw new TetherError("VALIDATION_FAILED", `${key} must be a non-empty string.`, []);
  }
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TetherError("VALIDATION_FAILED", `${key} must be a non-empty string.`, []);
  }
  return value;
}

function readRequiredInputString(input: unknown, key: string): string {
  const value = readInputString(input, key);
  if (value === undefined) {
    throw new TetherError("VALIDATION_FAILED", `${key} is required.`, [`${key} must be a non-empty string`]);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
