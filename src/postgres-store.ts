import { createHash } from "node:crypto";
import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from "pg";
import { TetherError } from "./errors.js";
import { encodeStorageKey } from "./storage-key.js";
import type {
  ApplyEventResult,
  AuditEvent,
  OutboxEvent,
  RelationshipRecord,
  StoredRelationshipModel
} from "./types.js";

export const TETHER_POSTGRES_MIGRATIONS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS tether_relationship_models (
    tenant_id text COLLATE "C" NOT NULL,
    model_id text COLLATE "C" NOT NULL,
    model_version text COLLATE "C" NOT NULL,
    document jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    created_by text COLLATE "C" NOT NULL,
    PRIMARY KEY (tenant_id, model_id, model_version)
  )`,
  `CREATE TABLE IF NOT EXISTS tether_relationships (
    tenant_id text COLLATE "C" NOT NULL,
    relationship_id text COLLATE "C" NOT NULL,
    model_id text COLLATE "C" NOT NULL,
    model_version text COLLATE "C" NOT NULL,
    subject_ref text COLLATE "C" NOT NULL,
    snapshot_version integer NOT NULL,
    document jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (tenant_id, relationship_id)
  )`,
  `CREATE TABLE IF NOT EXISTS tether_idempotency_keys (
    scope text COLLATE "C" PRIMARY KEY,
    tenant_id text COLLATE "C" NOT NULL,
    request_hash text COLLATE "C" NOT NULL,
    result jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS tether_audit_events (
    id text COLLATE "C" PRIMARY KEY,
    tenant_id text COLLATE "C" NOT NULL,
    actor_id text COLLATE "C" NOT NULL,
    action text COLLATE "C" NOT NULL,
    resource_id text COLLATE "C" NOT NULL,
    correlation_id text COLLATE "C" NOT NULL,
    metadata jsonb NOT NULL,
    created_at timestamptz NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tether_outbox_events (
    id text COLLATE "C" PRIMARY KEY,
    tenant_id text COLLATE "C" NOT NULL,
    event_type text COLLATE "C" NOT NULL,
    resource_id text COLLATE "C" NOT NULL,
    correlation_id text COLLATE "C" NOT NULL,
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

export interface TetherPostgresMigration {
  version: string;
  checksum: string;
  statements: readonly string[];
}

/** Structured ledger metadata. `TETHER_POSTGRES_MIGRATIONS` remains the published DDL string-array API. */
export const TETHER_POSTGRES_MIGRATION_METADATA: readonly TetherPostgresMigration[] = [
  {
    version: "001_initial",
    checksum: migrationChecksum(TETHER_POSTGRES_MIGRATIONS),
    statements: TETHER_POSTGRES_MIGRATIONS
  }
];

const MIGRATION_LOCK_NAME = "tether:postgres-migrations:v1";
const INITIAL_MIGRATION_TABLES = [
  "tether_relationship_models",
  "tether_relationships",
  "tether_idempotency_keys",
  "tether_audit_events",
  "tether_outbox_events"
] as const;

// Keep this order stable: PostgreSQL recommends acquiring locks on multiple
// objects in a consistent order to avoid upgrade deadlocks. Lock every
// baseline table so concurrent legacy writers cannot change JSON or scopes
// after the initial DDL but before the ledger becomes durable.
const BASELINE_TABLE_LOCKS = INITIAL_MIGRATION_TABLES;

const INITIAL_MIGRATION_COLUMNS: Readonly<Record<(typeof INITIAL_MIGRATION_TABLES)[number], readonly string[]>> = {
  tether_relationship_models: ["tenant_id", "model_id", "model_version", "document", "created_at", "created_by"],
  tether_relationships: ["tenant_id", "relationship_id", "model_id", "model_version", "subject_ref", "snapshot_version", "document", "created_at", "updated_at"],
  tether_idempotency_keys: ["scope", "tenant_id", "request_hash", "result", "created_at"],
  tether_audit_events: ["id", "tenant_id", "actor_id", "action", "resource_id", "correlation_id", "metadata", "created_at"],
  tether_outbox_events: ["id", "tenant_id", "event_type", "resource_id", "correlation_id", "payload", "created_at", "published_at"]
};

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

interface MigrationLedgerRow extends QueryResultRow {
  version: string;
  checksum: string;
}

interface LegacyTableRow extends QueryResultRow {
  table_name: string;
}

interface LegacyColumnRow extends QueryResultRow {
  table_name: string;
  column_name: string;
  type_name: string;
  is_nullable: boolean;
  column_default: string | null;
  collation_name: string | null;
}

interface LegacyConstraintRow extends QueryResultRow {
  table_name: string;
  constraint_type: "p" | "u";
  columns: string[];
}

interface LegacyIndexRow extends QueryResultRow {
  table_name: string;
  index_name: string;
  index_definition: string;
}

interface LegacyIdentityMismatchRow extends QueryResultRow {
  document_kind: string;
  tenant_id: string;
  record_id: string;
}

interface LegacyIdempotencyScopeRow extends QueryResultRow {
  scope: string;
  tenant_id: string;
  relationship_id: string | null;
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
    await this.withTransaction(async (client) => {
      await acquireAdvisoryLocks(client, [MIGRATION_LOCK_NAME]);
      await client.query(
        `CREATE TABLE IF NOT EXISTS tether_schema_migrations (
          version text PRIMARY KEY,
          checksum text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )`
      );
      const applied = await client.query<MigrationLedgerRow>(
        "SELECT version, checksum FROM tether_schema_migrations ORDER BY version"
      );
      const known = new Map(TETHER_POSTGRES_MIGRATION_METADATA.map((migration) => [migration.version, migration]));
      for (const row of applied.rows) {
        const migration = known.get(row.version);
        if (migration === undefined) {
          throw new Error(`PostgreSQL migration ${row.version} is applied but not known to this TETHER build.`);
        }
        if (migration.checksum !== row.checksum) {
          throw new Error(
            `PostgreSQL migration ${row.version} checksum changed after it was applied; restore the original migration and add a new forward migration.`
          );
        }
      }
      const appliedVersions = new Set(applied.rows.map((row) => row.version));
      for (const migration of TETHER_POSTGRES_MIGRATION_METADATA) {
        if (appliedVersions.has(migration.version)) {
          continue;
        }
        for (const statement of migration.statements) {
          await client.query(statement);
        }
        if (migration.version === "001_initial") {
          // A pre-DDL table-presence result is racy on an empty database. Once
          // DDL is complete, lock and validate the final state before ledger
          // insertion instead of trusting the earlier observation.
          await lockBaselineTables(client);
          await upgradeLegacyInitialSchema(client);
          await validateLegacyInitialSchema(client);
          await validateLegacyAuthoritativeDocuments(client);
          await validateLegacyIdempotencyScopes(client);
        }
        await client.query("INSERT INTO tether_schema_migrations (version, checksum) VALUES ($1, $2)", [
          migration.version,
          migration.checksum
        ]);
      }
    });
  }

  async rollbackForDevelopment(): Promise<void> {
    await this.withTransaction(async (client) => {
      for (const statement of TETHER_POSTGRES_ROLLBACK_MIGRATIONS) {
        await client.query(statement);
      }
      await client.query("DROP TABLE IF EXISTS tether_schema_migrations");
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async checkReadiness(): Promise<void> {
    await this.pool.query("SELECT 1");
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
      await acquireAdvisoryLocks(client, [
        encodeStorageKey("tether-lock", "relationship", application.relationship.tenantId, application.relationship.id),
        encodeStorageKey("tether-lock", "idempotency", application.idempotencyScope)
      ]);
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

      const updated = await client.query(
        `UPDATE tether_relationships
         SET snapshot_version = $1, document = $2::jsonb, updated_at = $3
         WHERE tenant_id = $4 AND relationship_id = $5 AND snapshot_version = $6
         RETURNING relationship_id`,
        [
          application.relationship.snapshot.version,
          JSON.stringify(application.relationship),
          application.relationship.updatedAt,
          application.relationship.tenantId,
          application.relationship.id,
          application.relationship.snapshot.version - 1
        ]
      );
      if (updated.rows.length !== 1) {
        throw new TetherError("VERSION_CONFLICT", "Relationship changed before the event could be applied.", []);
      }
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

function migrationChecksum(statements: readonly string[]): string {
  return createHash("sha256").update(statements.join("\n-- tether migration boundary --\n"), "utf8").digest("hex");
}

async function acquireAdvisoryLocks(client: Queryable, scopes: readonly string[]): Promise<void> {
  const keys = [...new Set(scopes.map(stableAdvisoryLockKey))].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  for (const key of keys) {
    await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [key.toString()]);
  }
}

function stableAdvisoryLockKey(scope: string): bigint {
  return createHash("sha256").update(scope, "utf8").digest().readBigInt64BE(0);
}

async function assertLegacyInitialTablesPresent(client: Queryable): Promise<void> {
  const tables = await client.query<LegacyTableRow>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`,
    [INITIAL_MIGRATION_TABLES]
  );
  const foundTables = new Set(tables.rows.map((row) => row.table_name));
  const missingTables = INITIAL_MIGRATION_TABLES.filter((table) => !foundTables.has(table));
  if (missingTables.length > 0) {
    throw new Error(`Legacy TETHER schema is incomplete and cannot be baselined: missing ${missingTables.join(", ")}.`);
  }
}

async function lockBaselineTables(client: Queryable): Promise<void> {
  for (const table of BASELINE_TABLE_LOCKS) {
    await client.query(`LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE`);
  }
}

async function upgradeLegacyInitialSchema(client: Queryable): Promise<void> {
  const legacyScopes = await client.query<LegacyIdempotencyScopeRow>(
    `SELECT scope, tenant_id, result #>> '{relationship,id}' AS relationship_id
     FROM tether_idempotency_keys
     FOR UPDATE`
  );
  for (const row of legacyScopes.rows) {
    if (row.relationship_id === null) {
      throw new Error(`Legacy TETHER idempotency scope cannot be upgraded: ${row.scope} has no relationship id in its replay result.`);
    }
    const legacyPrefix = `${row.tenant_id}:${row.relationship_id}:`;
    if (!row.scope.startsWith(legacyPrefix) || row.scope.length === legacyPrefix.length) {
      throw new Error(`Legacy TETHER idempotency scope cannot be upgraded without changing replay semantics: ${row.scope}.`);
    }
    const idempotencyKey = row.scope.slice(legacyPrefix.length);
    const upgradedScope = encodeStorageKey("idempotency", row.tenant_id, row.relationship_id, idempotencyKey);
    await client.query(
      "UPDATE tether_idempotency_keys SET scope = $1 WHERE scope = $2 AND tenant_id = $3",
      [upgradedScope, row.scope, row.tenant_id]
    );
  }
  for (const expectation of legacyColumnExpectations()) {
    if (expectation.collation === "C") {
      await client.query(`ALTER TABLE ${expectation.table} ALTER COLUMN ${expectation.column} TYPE text COLLATE "C"`);
    }
  }
}

async function validateLegacyInitialSchema(client: Queryable): Promise<void> {
  await assertLegacyInitialTablesPresent(client);
  const columns = await client.query<LegacyColumnRow>(
    `SELECT cls.relname AS table_name, attr.attname AS column_name,
            format_type(attr.atttypid, attr.atttypmod) AS type_name,
            attr.attnotnull = false AS is_nullable,
            pg_get_expr(def.adbin, def.adrelid) AS column_default,
            coll.collname AS collation_name
     FROM pg_attribute attr
     JOIN pg_class cls ON cls.oid = attr.attrelid
     JOIN pg_namespace ns ON ns.oid = cls.relnamespace
     LEFT JOIN pg_attrdef def ON def.adrelid = attr.attrelid AND def.adnum = attr.attnum
     LEFT JOIN pg_collation coll ON coll.oid = attr.attcollation
     WHERE ns.nspname = current_schema() AND cls.relname = ANY($1::text[])
       AND attr.attnum > 0 AND NOT attr.attisdropped`,
    [INITIAL_MIGRATION_TABLES]
  );
  const foundColumns = new Map<string, Map<string, LegacyColumnRow>>();
  for (const row of columns.rows) {
    const tableColumns = foundColumns.get(row.table_name) ?? new Map<string, LegacyColumnRow>();
    tableColumns.set(row.column_name, row);
    foundColumns.set(row.table_name, tableColumns);
  }
  for (const [table, expectedColumns] of Object.entries(INITIAL_MIGRATION_COLUMNS)) {
    const missingColumns = expectedColumns.filter((column) => !foundColumns.get(table)?.has(column));
    if (missingColumns.length > 0) {
      throw new Error(`Legacy TETHER schema is incompatible and cannot be baselined: ${table} is missing ${missingColumns.join(", ")}.`);
    }
  }
  for (const expectation of legacyColumnExpectations()) {
    const actual = foundColumns.get(expectation.table)?.get(expectation.column);
    if (actual === undefined || actual.type_name !== expectation.type || actual.is_nullable !== expectation.nullable) {
      throw new Error(`Legacy TETHER schema is incompatible and cannot be baselined: ${expectation.table}.${expectation.column} has an incompatible type or nullability.`);
    }
    if (expectation.default === "now" && !isNowDefault(actual.column_default)) {
      throw new Error(`Legacy TETHER schema is incompatible and cannot be baselined: ${expectation.table}.${expectation.column} is missing its required default.`);
    }
    if (expectation.collation !== undefined && actual.collation_name !== expectation.collation) {
      throw new Error(`Legacy TETHER schema is incompatible and cannot be baselined: ${expectation.table}.${expectation.column} must use ${expectation.collation} collation.`);
    }
  }
  const constraints = await client.query<LegacyConstraintRow>(
    `SELECT cls.relname AS table_name, con.contype AS constraint_type,
            array_agg(attr.attname ORDER BY key.ordinality) AS columns
     FROM pg_constraint con
     JOIN pg_class cls ON cls.oid = con.conrelid
     JOIN pg_namespace ns ON ns.oid = cls.relnamespace
     CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS key(attnum, ordinality)
     JOIN pg_attribute attr ON attr.attrelid = cls.oid AND attr.attnum = key.attnum
     WHERE ns.nspname = current_schema() AND cls.relname = ANY($1::text[]) AND con.contype IN ('p', 'u')
     GROUP BY cls.relname, con.contype, con.oid`,
    [INITIAL_MIGRATION_TABLES]
  );
  for (const expectation of legacyKeyExpectations()) {
    if (!constraints.rows.some((row) => row.table_name === expectation.table && row.constraint_type === expectation.type && sameColumns(row.columns, expectation.columns))) {
      throw new Error(`Legacy TETHER schema is incompatible and cannot be baselined: ${expectation.table} is missing its required ${expectation.type === "p" ? "primary" : "unique"} key.`);
    }
  }
  const indexes = await client.query<LegacyIndexRow>(
    `SELECT tbl.relname AS table_name, idx.relname AS index_name, pg_get_indexdef(ind.indexrelid) AS index_definition
     FROM pg_index ind
     JOIN pg_class idx ON idx.oid = ind.indexrelid
     JOIN pg_class tbl ON tbl.oid = ind.indrelid
     JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
     WHERE ns.nspname = current_schema() AND tbl.relname = ANY($1::text[])`,
    [INITIAL_MIGRATION_TABLES]
  );
  for (const expectation of legacyIndexExpectations()) {
    const actual = indexes.rows.find((row) => row.table_name === expectation.table && row.index_name === expectation.name);
    if (actual === undefined || !expectation.matches(actual.index_definition)) {
      throw new Error(`Legacy TETHER schema is incompatible and cannot be baselined: required index ${expectation.name} is missing or incompatible.`);
    }
  }
}

async function validateLegacyAuthoritativeDocuments(client: Queryable): Promise<void> {
  const mismatches = await client.query<LegacyIdentityMismatchRow>(
    `WITH mismatches AS (
       SELECT 'relationship model document' AS document_kind, tenant_id, model_id AS record_id
       FROM tether_relationship_models
       WHERE document->>'tenantId' IS DISTINCT FROM tenant_id
          OR document->>'id' IS DISTINCT FROM model_id
          OR document->>'version' IS DISTINCT FROM model_version
          OR document->>'createdBy' IS DISTINCT FROM created_by
          OR (document->>'createdAt')::timestamptz IS DISTINCT FROM created_at
       UNION ALL
       SELECT 'relationship document' AS document_kind, tenant_id, relationship_id AS record_id
       FROM tether_relationships
       WHERE document->>'tenantId' IS DISTINCT FROM tenant_id
          OR document->>'id' IS DISTINCT FROM relationship_id
          OR document->>'subjectRef' IS DISTINCT FROM subject_ref
          OR document->>'modelId' IS DISTINCT FROM model_id
          OR document->>'modelVersion' IS DISTINCT FROM model_version
          OR (document #>> '{snapshot,version}')::integer IS DISTINCT FROM snapshot_version
          OR document #>> '{snapshot,modelId}' IS DISTINCT FROM model_id
          OR document #>> '{snapshot,modelVersion}' IS DISTINCT FROM model_version
          OR (document->>'createdAt')::timestamptz IS DISTINCT FROM created_at
          OR (document->>'updatedAt')::timestamptz IS DISTINCT FROM updated_at
          OR (document #>> '{snapshot,updatedAt}')::timestamptz IS DISTINCT FROM updated_at
       UNION ALL
       SELECT 'idempotency result' AS document_kind, keys.tenant_id, keys.scope AS record_id
       FROM tether_idempotency_keys AS keys
       LEFT JOIN tether_relationships AS relationships
         ON relationships.tenant_id = keys.tenant_id
        AND relationships.relationship_id = (keys.result #>> '{relationship,id}')
       WHERE relationships.relationship_id IS NULL
          OR keys.result #>> '{relationship,tenantId}' IS DISTINCT FROM keys.tenant_id
          OR keys.result #>> '{relationship,id}' IS DISTINCT FROM relationships.relationship_id
          OR keys.result #>> '{relationship,subjectRef}' IS DISTINCT FROM relationships.subject_ref
          OR keys.result #>> '{relationship,modelId}' IS DISTINCT FROM relationships.model_id
          OR keys.result #>> '{relationship,modelVersion}' IS DISTINCT FROM relationships.model_version
          OR keys.result #>> '{relationship,snapshot,modelId}' IS DISTINCT FROM relationships.model_id
          OR keys.result #>> '{relationship,snapshot,modelVersion}' IS DISTINCT FROM relationships.model_version
          OR (keys.result #>> '{relationship,snapshot,version}')::integer > relationships.snapshot_version
          OR (keys.result #>> '{relationship,snapshot,version}')::integer IS DISTINCT FROM (keys.result #>> '{explanation,snapshotVersion}')::integer
          OR keys.result #>> '{explanation,relationshipId}' IS DISTINCT FROM keys.result #>> '{relationship,id}'
          OR (keys.result #>> '{relationship,updatedAt}')::timestamptz IS DISTINCT FROM (keys.result #>> '{relationship,snapshot,updatedAt}')::timestamptz
     )
     SELECT document_kind, tenant_id, record_id
     FROM mismatches
     LIMIT 1`
  );
  const mismatch = mismatches.rows[0];
  if (mismatch !== undefined) {
    throw new Error(
      `Legacy TETHER authoritative JSON is incompatible and cannot be baselined: ${mismatch.document_kind} identity mismatch for tenant ${mismatch.tenant_id} record ${mismatch.record_id}.`
    );
  }
}

async function validateLegacyIdempotencyScopes(client: Queryable): Promise<void> {
  const scopes = await client.query<LegacyIdempotencyScopeRow>(
    `SELECT scope, tenant_id, result #>> '{relationship,id}' AS relationship_id
     FROM tether_idempotency_keys
     /* tether baseline scope revalidation */
     FOR UPDATE`
  );
  for (const row of scopes.rows) {
    if (row.relationship_id === null) {
      throw new Error(`Legacy TETHER idempotency scope cannot be baselined: ${row.scope} has no relationship id in its replay result.`);
    }
    const legacyPrefix = `${row.tenant_id}:${row.relationship_id}:`;
    if (row.scope.startsWith(legacyPrefix)) {
      throw new Error(`Legacy TETHER idempotency scope cannot be baselined without changing replay semantics: ${row.scope}.`);
    }
  }
}

function legacyColumnExpectations(): readonly { table: string; column: string; type: string; nullable: boolean; default?: "now"; collation?: "C" }[] {
  const text = (table: string, columns: readonly string[]) => columns.map((column) => ({ table, column, type: "text", nullable: false, collation: "C" as const }));
  return [
    ...text("tether_relationship_models", ["tenant_id", "model_id", "model_version", "created_by"]),
    { table: "tether_relationship_models", column: "document", type: "jsonb", nullable: false }, { table: "tether_relationship_models", column: "created_at", type: "timestamp with time zone", nullable: false },
    ...text("tether_relationships", ["tenant_id", "relationship_id", "model_id", "model_version", "subject_ref"]),
    { table: "tether_relationships", column: "snapshot_version", type: "integer", nullable: false }, { table: "tether_relationships", column: "document", type: "jsonb", nullable: false },
    { table: "tether_relationships", column: "created_at", type: "timestamp with time zone", nullable: false }, { table: "tether_relationships", column: "updated_at", type: "timestamp with time zone", nullable: false },
    ...text("tether_idempotency_keys", ["scope", "tenant_id", "request_hash"]), { table: "tether_idempotency_keys", column: "result", type: "jsonb", nullable: false },
    { table: "tether_idempotency_keys", column: "created_at", type: "timestamp with time zone", nullable: false, default: "now" },
    ...text("tether_audit_events", ["id", "tenant_id", "actor_id", "action", "resource_id", "correlation_id"]), { table: "tether_audit_events", column: "metadata", type: "jsonb", nullable: false }, { table: "tether_audit_events", column: "created_at", type: "timestamp with time zone", nullable: false },
    ...text("tether_outbox_events", ["id", "tenant_id", "event_type", "resource_id", "correlation_id"]), { table: "tether_outbox_events", column: "payload", type: "jsonb", nullable: false },
    { table: "tether_outbox_events", column: "created_at", type: "timestamp with time zone", nullable: false }, { table: "tether_outbox_events", column: "published_at", type: "timestamp with time zone", nullable: true }
  ];
}

function legacyKeyExpectations(): readonly { table: string; type: "p" | "u"; columns: readonly string[] }[] {
  return [
    { table: "tether_relationship_models", type: "p", columns: ["tenant_id", "model_id", "model_version"] },
    { table: "tether_relationships", type: "p", columns: ["tenant_id", "relationship_id"] },
    { table: "tether_idempotency_keys", type: "p", columns: ["scope"] },
    { table: "tether_audit_events", type: "p", columns: ["id"] },
    { table: "tether_outbox_events", type: "p", columns: ["id"] }
  ];
}

function legacyIndexExpectations(): readonly { table: string; name: string; matches(definition: string): boolean }[] {
  return [
    { table: "tether_relationships", name: "tether_relationships_tenant_model_idx", matches: (definition) => /\(tenant_id, model_id, model_version\)/.test(definition) },
    { table: "tether_audit_events", name: "tether_audit_events_tenant_resource_idx", matches: (definition) => /\(tenant_id, resource_id, created_at\)/.test(definition) },
    { table: "tether_outbox_events", name: "tether_outbox_events_unpublished_idx", matches: (definition) => /\(tenant_id, created_at\).*WHERE \(published_at IS NULL\)/.test(definition) }
  ];
}

function sameColumns(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((column, index) => column === expected[index]);
}

function isNowDefault(value: string | null): boolean {
  return value === "now()" || value === "CURRENT_TIMESTAMP";
}
