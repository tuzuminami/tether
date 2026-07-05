export type TetherErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "TENANT_SCOPE_DENIED"
  | "RESOURCE_NOT_FOUND"
  | "VALIDATION_FAILED"
  | "VERSION_CONFLICT"
  | "RESOURCE_IMMUTABLE"
  | "IDEMPOTENCY_CONFLICT"
  | "PLUGIN_INCOMPATIBLE"
  | "DEPENDENCY_UNAVAILABLE";

export type TetherScope = "model:write" | "relationship:write" | "relationship:read";

export interface RequestContext {
  tenantId: string;
  actorId: string;
  scopes: TetherScope[];
  correlationId: string;
}

export interface RelationshipAxis {
  id: string;
  min: number;
  max: number;
  initial: number;
}

export interface RelationshipEventDeclaration {
  type: string;
}

export interface TransitionRule {
  id: string;
  eventType: string;
  axis: string;
  delta: number;
  reasonCode: string;
}

export interface BoundaryRule {
  id: string;
  eventType: string;
  axis: string;
  blocksPositiveDelta: boolean;
  policyRef: string;
}

export interface DecayRule {
  axis: string;
  perDay: number;
}

export interface RelationshipModel {
  id: string;
  version: string;
  axes: RelationshipAxis[];
  events: RelationshipEventDeclaration[];
  transitionRules: TransitionRule[];
  boundaryRules: BoundaryRule[];
  decayRules: DecayRule[];
}

export interface StoredRelationshipModel extends RelationshipModel {
  tenantId: string;
  createdAt: string;
  createdBy: string;
  resourceVersion: number;
}

export interface RelationshipSnapshot {
  version: number;
  values: Record<string, number>;
  modelId: string;
  modelVersion: string;
  updatedAt: string;
}

export interface RelationshipEventInput {
  id?: string;
  type?: string;
  payload?: unknown;
}

export interface RelationshipExplanationWarning {
  boundaryRuleId: string;
  policyRef: string;
  reasonCode: "BOUNDARY_BLOCKED";
}

export interface RelationshipExplanation {
  id: string;
  relationshipId: string;
  snapshotVersion: number;
  eventId: string;
  eventType: string;
  eventHash: string;
  ruleIds: string[];
  before: Record<string, number>;
  after: Record<string, number>;
  warnings: RelationshipExplanationWarning[];
  reasonCode: "TRANSITION_APPLIED" | "NO_TRANSITION_APPLIED";
  createdAt: string;
}

export interface RelationshipRecord {
  id: string;
  tenantId: string;
  subjectRef: string;
  modelId: string;
  modelVersion: string;
  snapshot: RelationshipSnapshot;
  explanations: RelationshipExplanation[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  resourceId: string;
  correlationId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface OutboxEvent {
  id: string;
  tenantId: string;
  eventType: string;
  resourceId: string;
  correlationId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface IdempotencyEntry<T> {
  requestHash: string;
  result: T;
}

export interface ApplyEventResult {
  relationship: RelationshipRecord;
  explanation: RelationshipExplanation;
}

export interface DecayPreview {
  relationshipId: string;
  baselineAt: string;
  fromSnapshotVersion: number;
  values: Record<string, number>;
}

export interface SimulateEventResult {
  relationshipId: string;
  fromSnapshotVersion: number;
  projectedSnapshotVersion: number;
  explanation: RelationshipExplanation;
  values: Record<string, number>;
}
