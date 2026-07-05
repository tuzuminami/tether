import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from "pg";
import { TetherError } from "./errors.js";
import type {
  ApplyEventResult,
  AuditEvent,
  OutboxEvent,
  RelationshipRecord,
  StoredRelationshipModel
} from "./types.js";

export const TETHER_POSTGRES_MIGRATIONS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS tether_relationship_models (
    tenant_id text NOT NULL,
    model_id text NOT NULL,
    model_version text NOT NULL,
    document jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    created_by text NOT NULL,
    PRIMARY KEY (tenant_id, model_id, model_version)
  )`,
  `CREATE TABLE IF NOT EXISTS tether_relationships (
    tenant_id text NOT NULL,
    relationship_id text NOT NULL,
    model_id text NOT NULL,
    model_version text NOT NULL,
    subject_ref text NOT NULL,
    snapshot_version integer NOT NULL,
    document jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (tenant_id, relationship_id)
  )`,
  `CREATE TABLE IF NOT EXISTS tether_idempotency_keys (
    scope text PRIMARY KEY,
    tenant_id text NOT NULL,
    request_hash text NOT NULL,
    result jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS tether_audit_events (
    id text PRIMARY KEY,
    tenant_id text NOT NULL,
    actor_id text NOT NULL,
    action text NOT NULL,
    resource_id text NOT NULL,
    correlation_id text NOT NULL,
    metadata jsonb NOT NULL,
    created_at timestamptz NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tether_outbox_events (
    id text PRIMARY KEY,
    tenant_id text NOT NULL,
    event_type text NOT NULL,
    resource_id text NOT NULL,
    correlation_id text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    published_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS tether_relationships_tenant_model_idx
    ON tether_relationships (tenant_id, model_id, model_version)`,
  `CREATE INDEX IF NOT EXISTS tether_audit_events_tenant_resource_idx
    ON tether_audit_events (tenant_id, resource_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS tether_outbox_events_unpublished_idx
    ON tether_outbox_events (tenant_id, created_at)
    WHERE published_at IS NULL`
];

export const TETHER_POSTGRES_ROLLBACK_MIGRATIONS: readonly string[] = [
  "DROP INDEX IF EXISTS tether_outbox_events_unpublished_idx",
  "DROP INDEX IF EXISTS tether_audit_events_tenant_resource_idx",
  "DROP INDEX IF EXISTS tether_relationships_tenant_model_idx",
  "DROP TABLE IF EXISTS tether_outbox_events",
  "DROP TABLE IF EXISTS tether_audit_events",
  "DROP TABLE IF EXISTS tether_idempotency_keys",
  "DROP TABLE IF EXISTS tether_relationships",
  "DROP TABLE IF EXISTS tether_relationship_models"
];

export interface PostgresEventApplication {
  relationship: RelationshipRecord;
  explanation: ApplyEventResult["explanation"];
  idempotencyScope: string;
  requestHash: string;
  result: ApplyEventResult;
  auditEvent: AuditEvent;
  outboxEvent: OutboxEvent;
}

type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<T>>;
};

type TransactionClient = Queryable & {
  release(): void;
};

interface JsonDocumentRow<T> extends QueryResultRow {
  document: T;
}

interface IdempotencyRow extends QueryResultRow {
  request_hash: string;
  result: ApplyEventResult;
}

export class PostgresRelationshipStore {
  private readonly pool: PoolLike;

  constructor(pool: PoolLike | PoolConfig | string) {
    this.pool = typeof pool === "string" ? new Pool({ connectionString: pool }) : isPoolConfig(pool) ? new Pool(pool) : pool;
  }

  static fromConnectionString(connectionString: string): PostgresRelationshipStore {
    return new PostgresRelationshipStore(connectionString);
  }

  async migrate(): Promise<void> {
    for (const statement of TETHER_POSTGRES_MIGRATIONS) {
      await this.pool.query(statement);
    }
  }

  async rollbackForDevelopment(): Promise<void> {
    for (const statement of TETHER_POSTGRES_ROLLBACK_MIGRATIONS) {
      await this.pool.query(statement);
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async createModel(record: StoredRelationshipModel, auditEvent: AuditEvent): Promise<void> {
    await this.withTransaction(async (client) => {
      await client.query(
        `INSERT INTO tether_relationship_models
          (tenant_id, model_id, model_version, document, created_at, created_by)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
        [record.tenantId, record.id, record.version, JSON.stringify(record), record.createdAt, record.createdBy]
      );
      await insertAuditEvent(client, auditEvent);
    });
  }

  async getModel(tenantId: string, modelId: string, modelVersion: string): Promise<StoredRelationshipModel | null> {
    const result = await this.pool.query<JsonDocumentRow<StoredRelationshipModel>>(
      `SELECT document
       FROM tether_relationship_models
       WHERE tenant_id = $1 AND model_id = $2 AND model_version = $3`,
      [tenantId, modelId, modelVersion]
    );
    return result.rows[0]?.document ?? null;
  }

  async createRelationship(record: RelationshipRecord, auditEvent: AuditEvent, outboxEvent: OutboxEvent): Promise<void> {
    await this.withTransaction(async (client) => {
      await client.query(
        `INSERT INTO tether_relationships
          (tenant_id, relationship_id, model_id, model_version, subject_ref, snapshot_version, document, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
        [
          record.tenantId,
          record.id,
          record.modelId,
          record.modelVersion,
          record.subjectRef,
          record.snapshot.version,
          JSON.stringify(record),
          record.createdAt,
          record.updatedAt
        ]
      );
      await insertAuditEvent(client, auditEvent);
      await insertOutboxEvent(client, outboxEvent);
    });
  }

  async getRelationship(tenantId: string, relationshipId: string): Promise<RelationshipRecord | null> {
    const result = await this.pool.query<JsonDocumentRow<RelationshipRecord>>(
      `SELECT document
       FROM tether_relationships
       WHERE tenant_id = $1 AND relationship_id = $2`,
      [tenantId, relationshipId]
    );
    return result.rows[0]?.document ?? null;
  }

  async saveEventApplication(application: PostgresEventApplication): Promise<ApplyEventResult> {
    return this.withTransaction(async (client) => {
      const idempotency = await client.query<IdempotencyRow>(
        `SELECT request_hash, result
         FROM tether_idempotency_keys
         WHERE scope = $1 AND tenant_id = $2
         FOR UPDATE`,
        [application.idempotencyScope, application.relationship.tenantId]
      );
      const existing = idempotency.rows[0];
      if (existing !== undefined) {
        if (existing.request_hash !== application.requestHash) {
          throw new TetherError("IDEMPOTENCY_CONFLICT", "Idempotency key was reused with a different request.", []);
        }
        return existing.result;
      }

      await client.query(
        `UPDATE tether_relationships
         SET snapshot_version = $1, document = $2::jsonb, updated_at = $3
         WHERE tenant_id = $4 AND relationship_id = $5`,
        [
          application.relationship.snapshot.version,
          JSON.stringify(application.relationship),
          application.relationship.updatedAt,
          application.relationship.tenantId,
          application.relationship.id
        ]
      );
      await insertAuditEvent(client, application.auditEvent);
      await insertOutboxEvent(client, application.outboxEvent);
      await client.query(
        `INSERT INTO tether_idempotency_keys (scope, tenant_id, request_hash, result)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [
          application.idempotencyScope,
          application.relationship.tenantId,
          application.requestHash,
          JSON.stringify(application.result)
        ]
      );
      return application.result;
    });
  }

  private async withTransaction<T>(operation: (client: TransactionClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw mapPostgresError(error);
    } finally {
      client.release();
    }
  }
}

export type PoolLike = Queryable & {
  connect(): Promise<TransactionClient>;
  end(): Promise<void>;
};

function isPoolConfig(value: PoolLike | PoolConfig): value is PoolConfig {
  return typeof value === "object" && value !== null && !("query" in value) && !("connect" in value);
}

async function insertAuditEvent(client: Queryable, event: AuditEvent): Promise<void> {
  await client.query(
    `INSERT INTO tether_audit_events
      (id, tenant_id, actor_id, action, resource_id, correlation_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [
      event.id,
      event.tenantId,
      event.actorId,
      event.action,
      event.resourceId,
      event.correlationId,
      JSON.stringify(event.metadata),
      event.createdAt
    ]
  );
}

async function insertOutboxEvent(client: Queryable, event: OutboxEvent): Promise<void> {
  await client.query(
    `INSERT INTO tether_outbox_events
      (id, tenant_id, event_type, resource_id, correlation_id, payload, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [
      event.id,
      event.tenantId,
      event.eventType,
      event.resourceId,
      event.correlationId,
      JSON.stringify(event.payload),
      event.createdAt
    ]
  );
}

function mapPostgresError(error: unknown): unknown {
  if (isPostgresError(error) && error.code === "23505") {
    return new TetherError("RESOURCE_IMMUTABLE", "Resource already exists.", ["database unique constraint rejected write"]);
  }
  return error;
}

function isPostgresError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string";
}
