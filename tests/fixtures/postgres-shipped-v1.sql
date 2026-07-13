-- Fixed TETHER v1 shipped DDL. Do not derive this fixture from current migrations.
CREATE TABLE tether_relationship_models (
  tenant_id text NOT NULL,
  model_id text NOT NULL,
  model_version text NOT NULL,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL,
  PRIMARY KEY (tenant_id, model_id, model_version)
);
CREATE TABLE tether_relationships (
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
);
CREATE TABLE tether_idempotency_keys (
  scope text PRIMARY KEY,
  tenant_id text NOT NULL,
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tether_audit_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  resource_id text NOT NULL,
  correlation_id text NOT NULL,
  metadata jsonb NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE TABLE tether_outbox_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  event_type text NOT NULL,
  resource_id text NOT NULL,
  correlation_id text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  published_at timestamptz
);
CREATE INDEX tether_relationships_tenant_model_idx ON tether_relationships (tenant_id, model_id, model_version);
CREATE INDEX tether_audit_events_tenant_resource_idx ON tether_audit_events (tenant_id, resource_id, created_at);
CREATE INDEX tether_outbox_events_unpublished_idx ON tether_outbox_events (tenant_id, created_at) WHERE published_at IS NULL;
