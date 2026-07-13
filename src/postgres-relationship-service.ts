import { randomUUID } from "node:crypto";
import { canonicalJson, sha256Hex } from "./canonical-json.js";
import { TetherError } from "./errors.js";
import { parseRelationshipModel } from "./relationship-model.js";
import { PostgresRelationshipStore } from "./postgres-store.js";
import { encodeStorageKey } from "./storage-key.js";
import type {
  ApplyEventResult,
  AuditEvent,
  DecayPreview,
  OutboxEvent,
  RelationshipEventInput,
  RelationshipExplanation,
  RelationshipExplanationWarning,
  RelationshipRecord,
  RequestContext,
  SimulateEventResult,
  StoredRelationshipModel,
  TetherScope
} from "./types.js";

export interface PostgresRelationshipServiceOptions {
  now?: () => string;
  idGenerator?: () => string;
}

/** Durable counterpart to RelationshipService for the packaged PostgreSQL HTTP runtime. */
export class PostgresRelationshipService {
  private readonly now: () => string;
  private readonly idGenerator: () => string;

  constructor(
    private readonly store: PostgresRelationshipStore,
    options: PostgresRelationshipServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.idGenerator = options.idGenerator ?? (() => randomUUID());
  }

  async createModel(context: RequestContext, input: unknown): Promise<StoredRelationshipModel> {
    requireScope(context, "model:write");
    const model = parseRelationshipModel(input);
    const record: StoredRelationshipModel = {
      ...model,
      tenantId: context.tenantId,
      createdAt: this.now(),
      createdBy: context.actorId,
      resourceVersion: 1
    };
    await this.store.createModel(record, this.audit(context, "relationship_model.created", model.id, { modelVersion: model.version }));
    return record;
  }

  async createRelationship(context: RequestContext, input: unknown): Promise<RelationshipRecord> {
    requireScope(context, "relationship:write");
    const modelId = requiredString(input, "modelId");
    const modelVersion = requiredString(input, "modelVersion");
    const subjectRef = requiredString(input, "subjectRef");
    const model = await this.getModel(context, modelId, modelVersion);
    const now = this.now();
    const relationship: RelationshipRecord = {
      id: optionalString(input, "id") ?? this.idGenerator(),
      tenantId: context.tenantId,
      subjectRef,
      modelId: model.id,
      modelVersion: model.version,
      snapshot: {
        version: 1,
        values: Object.fromEntries(model.axes.map((axis) => [axis.id, axis.initial])),
        modelId: model.id,
        modelVersion: model.version,
        updatedAt: now
      },
      explanations: [],
      createdAt: now,
      createdBy: context.actorId,
      updatedAt: now
    };
    await this.store.createRelationship(
      relationship,
      this.audit(context, "relationship.created", relationship.id, { modelId: model.id, modelVersion: model.version }),
      this.outbox(context, "tether.relationship.created.v1", relationship.id, { snapshotVersion: 1 })
    );
    return relationship;
  }

  async applyEvent(
    context: RequestContext,
    relationshipId: string,
    event: RelationshipEventInput,
    idempotencyKey: string | undefined
  ): Promise<ApplyEventResult> {
    requireScope(context, "relationship:write");
    if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
      throw new TetherError("VALIDATION_FAILED", "Idempotency key is required.", ["idempotencyKey must be non-empty"]);
    }
    const relationship = await this.getRelationship(context, relationshipId);
    const { after, explanation } = await this.projectEvent(relationship, event);
    const updated: RelationshipRecord = {
      ...relationship,
      snapshot: {
        version: relationship.snapshot.version + 1,
        values: after,
        modelId: relationship.modelId,
        modelVersion: relationship.modelVersion,
        updatedAt: explanation.createdAt
      },
      explanations: [...relationship.explanations, explanation],
      updatedAt: explanation.createdAt
    };
    const result = { relationship: updated, explanation };
    return this.store.saveEventApplication({
      relationship: updated,
      explanation,
      idempotencyScope: encodeStorageKey("idempotency", context.tenantId, relationshipId, idempotencyKey),
      requestHash: sha256Hex(canonicalJson({ relationshipId, event })),
      result,
      auditEvent: this.audit(context, "relationship.event_applied", relationshipId, {
        snapshotVersion: updated.snapshot.version,
        eventType: explanation.eventType,
        eventHash: explanation.eventHash
      }),
      outboxEvent: this.outbox(context, "tether.relationship.event-applied.v1", relationshipId, {
        snapshotVersion: updated.snapshot.version,
        eventType: explanation.eventType
      })
    });
  }

  async simulateEvent(context: RequestContext, relationshipId: string, event: RelationshipEventInput): Promise<SimulateEventResult> {
    requireScope(context, "relationship:read");
    const relationship = await this.getRelationship(context, relationshipId);
    const { after, explanation } = await this.projectEvent(relationship, event);
    return {
      relationshipId,
      fromSnapshotVersion: relationship.snapshot.version,
      projectedSnapshotVersion: relationship.snapshot.version + 1,
      explanation,
      values: after
    };
  }

  async getExplanation(context: RequestContext, relationshipId: string): Promise<RelationshipExplanation | null> {
    requireScope(context, "relationship:read");
    return (await this.getRelationship(context, relationshipId)).explanations.at(-1) ?? null;
  }

  async previewDecay(context: RequestContext, relationshipId: string, baselineAt: string): Promise<DecayPreview> {
    requireScope(context, "relationship:read");
    const relationship = await this.getRelationship(context, relationshipId);
    const model = await this.getModel(context, relationship.modelId, relationship.modelVersion);
    const elapsedMs = Date.parse(baselineAt) - Date.parse(relationship.snapshot.updatedAt);
    if (!Number.isFinite(elapsedMs)) {
      throw new TetherError("VALIDATION_FAILED", "baselineAt must be an ISO timestamp.", []);
    }
    const elapsedDays = Math.max(0, elapsedMs / 86_400_000);
    const values = { ...relationship.snapshot.values };
    for (const rule of model.decayRules) {
      const axis = model.axes.find((candidate) => candidate.id === rule.axis);
      if (axis === undefined) continue;
      const current = values[rule.axis] ?? axis.initial;
      const direction = current > axis.initial ? -1 : current < axis.initial ? 1 : 0;
      values[rule.axis] = clamp(current + direction * Math.min(Math.abs(current - axis.initial), rule.perDay * elapsedDays), axis.min, axis.max);
    }
    return { relationshipId, baselineAt, fromSnapshotVersion: relationship.snapshot.version, values };
  }

  private async getModel(context: RequestContext, modelId: string, modelVersion: string): Promise<StoredRelationshipModel> {
    const model = await this.store.getModel(context.tenantId, modelId, modelVersion);
    if (model === null) throw new TetherError("RESOURCE_NOT_FOUND", "Resource was not found.", []);
    return model;
  }

  private async getRelationship(context: RequestContext, relationshipId: string): Promise<RelationshipRecord> {
    const relationship = await this.store.getRelationship(context.tenantId, relationshipId);
    if (relationship === null) throw new TetherError("RESOURCE_NOT_FOUND", "Resource was not found.", []);
    return relationship;
  }

  private async projectEvent(relationship: RelationshipRecord, event: RelationshipEventInput): Promise<{ after: Record<string, number>; explanation: RelationshipExplanation }> {
    const model = await this.getModel({ tenantId: relationship.tenantId, actorId: relationship.createdBy, scopes: ["relationship:read"], correlationId: "internal_projection" }, relationship.modelId, relationship.modelVersion);
    const eventType = optionalString(event, "type");
    const eventId = optionalString(event, "id") ?? this.idGenerator();
    if (eventType === undefined || !model.events.some((declared) => declared.type === eventType)) {
      throw new TetherError("VALIDATION_FAILED", "Relationship event validation failed.", [`event type ${eventType ?? "<missing>"} is not declared by the model`]);
    }
    const before = { ...relationship.snapshot.values };
    const after = { ...before };
    const ruleIds: string[] = [];
    const warnings: RelationshipExplanationWarning[] = [];
    for (const rule of model.transitionRules.filter((candidate) => candidate.eventType === eventType)) {
      const axis = model.axes.find((candidate) => candidate.id === rule.axis);
      if (axis === undefined) throw new TetherError("VALIDATION_FAILED", "Transition rule references an unknown axis.", [rule.axis]);
      const boundary = model.boundaryRules.find((candidate) => candidate.eventType === eventType && candidate.axis === rule.axis && candidate.blocksPositiveDelta);
      if (boundary !== undefined && rule.delta > 0) {
        warnings.push({ boundaryRuleId: boundary.id, policyRef: boundary.policyRef, reasonCode: "BOUNDARY_BLOCKED" });
        continue;
      }
      after[rule.axis] = clamp((after[rule.axis] ?? axis.initial) + rule.delta, axis.min, axis.max);
      ruleIds.push(rule.id);
    }
    const createdAt = this.now();
    return { after, explanation: { id: this.idGenerator(), relationshipId: relationship.id, snapshotVersion: relationship.snapshot.version + 1, eventId, eventType, eventHash: sha256Hex(canonicalJson({ id: eventId, type: eventType, payload: event.payload ?? null })), ruleIds, before, after, warnings, reasonCode: ruleIds.length > 0 ? "TRANSITION_APPLIED" : "NO_TRANSITION_APPLIED", createdAt } };
  }

  private audit(context: RequestContext, action: string, resourceId: string, metadata: Record<string, unknown>): AuditEvent {
    return { id: this.idGenerator(), tenantId: context.tenantId, actorId: context.actorId, action, resourceId, correlationId: context.correlationId, metadata, createdAt: this.now() };
  }

  private outbox(context: RequestContext, eventType: string, resourceId: string, payload: Record<string, unknown>): OutboxEvent {
    return { id: this.idGenerator(), tenantId: context.tenantId, eventType, resourceId, correlationId: context.correlationId, payload, createdAt: this.now() };
  }
}

function requireScope(context: RequestContext | undefined, scope: TetherScope): void {
  if (context === undefined || typeof context.tenantId !== "string" || typeof context.actorId !== "string") throw new TetherError("AUTHENTICATION_REQUIRED", "Authentication is required.", []);
  if (!Array.isArray(context.scopes) || !context.scopes.includes(scope)) throw new TetherError("TENANT_SCOPE_DENIED", "Request cannot access this resource.", []);
}
function optionalString(input: unknown, key: string): string | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new TetherError("VALIDATION_FAILED", `${key} must be a non-empty string.`, []);
  const value = (input as Record<string, unknown>)[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) throw new TetherError("VALIDATION_FAILED", `${key} must be a non-empty string.`, []);
  return value;
}
function requiredString(input: unknown, key: string): string {
  const value = optionalString(input, key);
  if (value === undefined) throw new TetherError("VALIDATION_FAILED", `${key} is required.`, [`${key} must be a non-empty string`]);
  return value;
}
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
