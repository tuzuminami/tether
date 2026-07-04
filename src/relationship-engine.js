import { canonicalJson, sha256Hex } from "./canonical-json.js";
import { TetherError } from "./errors.js";
import { parseRelationshipModel } from "./relationship-model.js";

export class InMemoryRelationshipStore {
  constructor() {
    this.models = new Map();
    this.relationships = new Map();
    this.idempotency = new Map();
    this.auditEvents = [];
    this.outboxEvents = [];
  }

  modelKey(tenantId, modelId, modelVersion) {
    return `${tenantId}:${modelId}:${modelVersion}`;
  }

  relationshipKey(tenantId, relationshipId) {
    return `${tenantId}:${relationshipId}`;
  }
}

export class RelationshipService {
  constructor(store, options = {}) {
    this.store = store;
    this.now = options.now ?? (() => new Date().toISOString());
    this.idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
  }

  createModel(context, input) {
    requireScope(context, "model:write");
    const model = parseRelationshipModel(input);
    const now = this.now();
    const record = {
      ...model,
      tenantId: context.tenantId,
      createdAt: now,
      createdBy: context.actorId,
      resourceVersion: 1
    };
    this.store.models.set(this.store.modelKey(context.tenantId, model.id, model.version), record);
    this.appendAudit(context, "relationship_model.created", model.id, { modelVersion: model.version });
    return record;
  }

  createRelationship(context, input) {
    requireScope(context, "relationship:write");
    const model = this.getModel(context, input.modelId, input.modelVersion);
    const now = this.now();
    const values = Object.fromEntries(model.axes.map((axis) => [axis.id, axis.initial]));
    const relationship = {
      id: readInputString(input, "id") ?? this.idGenerator(),
      tenantId: context.tenantId,
      subjectRef: readInputString(input, "subjectRef"),
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
    this.store.relationships.set(this.store.relationshipKey(context.tenantId, relationship.id), relationship);
    this.appendAudit(context, "relationship.created", relationship.id, { modelId: model.id, modelVersion: model.version });
    this.appendOutbox(context, "tether.relationship.created.v1", relationship.id, { snapshotVersion: 1 });
    return relationship;
  }

  applyEvent(context, relationshipId, event, idempotencyKey) {
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
    if (!model.events.some((declaredEvent) => declaredEvent.type === eventType)) {
      throw new TetherError("VALIDATION_FAILED", "Relationship event validation failed.", [
        `event type ${eventType} is not declared by the model`
      ]);
    }

    const before = { ...relationship.snapshot.values };
    const matchingRules = model.transitionRules.filter((rule) => rule.eventType === eventType);
    const appliedRules = [];
    const warnings = [];
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

    const explanation = {
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
      createdAt: this.now()
    };

    relationship.snapshot = {
      version: relationship.snapshot.version + 1,
      values: after,
      modelId: model.id,
      modelVersion: model.version,
      updatedAt: explanation.createdAt
    };
    relationship.updatedAt = explanation.createdAt;
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

  getExplanation(context, relationshipId) {
    requireScope(context, "relationship:read");
    const relationship = this.getRelationship(context, relationshipId);
    return relationship.explanations.at(-1) ?? null;
  }

  previewDecay(context, relationshipId, baselineAt) {
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

  getModel(context, modelId, modelVersion) {
    const model = this.store.models.get(this.store.modelKey(context.tenantId, modelId, modelVersion));
    if (model === undefined) {
      throw new TetherError("RESOURCE_NOT_FOUND", "Resource was not found.", []);
    }
    return model;
  }

  getRelationship(context, relationshipId) {
    const relationship = this.store.relationships.get(this.store.relationshipKey(context.tenantId, relationshipId));
    if (relationship === undefined) {
      throw new TetherError("RESOURCE_NOT_FOUND", "Resource was not found.", []);
    }
    return relationship;
  }

  appendAudit(context, action, resourceId, metadata) {
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

  appendOutbox(context, eventType, resourceId, payload) {
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

export function createDevelopmentContext(overrides = {}) {
  return {
    tenantId: "tenant_demo",
    actorId: "actor_demo",
    scopes: ["model:write", "relationship:write", "relationship:read"],
    correlationId: "corr_demo",
    ...overrides
  };
}

function requireScope(context, scope) {
  if (context === undefined || typeof context.tenantId !== "string" || typeof context.actorId !== "string") {
    throw new TetherError("AUTHENTICATION_REQUIRED", "Authentication is required.", []);
  }
  if (!Array.isArray(context.scopes) || !context.scopes.includes(scope)) {
    throw new TetherError("TENANT_SCOPE_DENIED", "Request cannot access this resource.", []);
  }
}

function readInputString(input, key) {
  const value = input?.[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TetherError("VALIDATION_FAILED", `${key} must be a non-empty string.`, []);
  }
  return value;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
