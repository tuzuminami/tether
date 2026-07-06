import type { Server } from "node:http";
import { createDefaultApiRuntime } from "./http-api.js";
import { PostgresRelationshipStore } from "./postgres-store.js";
import type { InMemoryRelationshipStore, RelationshipService } from "./relationship-engine.js";

export type TetherRuntimeStore = "memory" | "postgres";

export interface TetherApiRuntimeConfig {
  port: number;
  runtimeStore: TetherRuntimeStore;
  migratePostgres: boolean;
  databaseUrl?: string;
}

export interface TetherConfiguredApiRuntime {
  config: TetherApiRuntimeConfig;
  store: InMemoryRelationshipStore;
  service: RelationshipService;
  server: Server;
}

export interface TetherApiRuntimeEnvironment {
  PORT?: string | undefined;
  TETHER_RUNTIME_STORE?: string | undefined;
  TETHER_MIGRATE_POSTGRES?: string | undefined;
  DATABASE_URL?: string | undefined;
}

interface MigratingPostgresStore {
  migrate(): Promise<void>;
  close(): Promise<void>;
}

export interface CreateConfiguredApiRuntimeOptions {
  env?: TetherApiRuntimeEnvironment | undefined;
  createPostgresStore?: ((databaseUrl: string) => MigratingPostgresStore) | undefined;
}

export async function createConfiguredApiRuntime(
  options: CreateConfiguredApiRuntimeOptions = {}
): Promise<TetherConfiguredApiRuntime> {
  const config = resolveTetherApiRuntimeConfig(options.env ?? process.env);
  if (config.runtimeStore === "postgres") {
    throw new Error(
      "TETHER_RUNTIME_STORE=postgres is fail-closed: the HTTP runtime is not yet wired to a durable RelationshipService store."
    );
  }

  if (config.migratePostgres) {
    const databaseUrl = requireDatabaseUrl(config);
    const createPostgresStore =
      options.createPostgresStore ?? ((url: string): MigratingPostgresStore => PostgresRelationshipStore.fromConnectionString(url));
    const postgres = createPostgresStore(databaseUrl);
    try {
      await postgres.migrate();
    } finally {
      await postgres.close();
    }
  }

  return { config, ...createDefaultApiRuntime() };
}

export function resolveTetherApiRuntimeConfig(env: TetherApiRuntimeEnvironment): TetherApiRuntimeConfig {
  const port = parsePort(env.PORT ?? "3000");
  const runtimeStore = parseRuntimeStore(requireRuntimeStore(env.TETHER_RUNTIME_STORE));
  const migratePostgres = parseBooleanFlag(env.TETHER_MIGRATE_POSTGRES ?? "0", "TETHER_MIGRATE_POSTGRES");
  const databaseUrl = normalizeOptional(env.DATABASE_URL);

  return databaseUrl === undefined
    ? { port, runtimeStore, migratePostgres }
    : { port, runtimeStore, migratePostgres, databaseUrl };
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || `${port}` !== value) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

function requireRuntimeStore(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw new Error("TETHER_RUNTIME_STORE must be set explicitly to memory or postgres.");
  }
  return value;
}

function parseRuntimeStore(value: string): TetherRuntimeStore {
  if (value === "memory" || value === "postgres") {
    return value;
  }
  throw new Error("TETHER_RUNTIME_STORE must be either memory or postgres.");
}

function parseBooleanFlag(value: string, name: string): boolean {
  if (value === "1") {
    return true;
  }
  if (value === "0") {
    return false;
  }
  throw new Error(`${name} must be 0 or 1.`);
}

function normalizeOptional(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  return value;
}

function requireDatabaseUrl(config: TetherApiRuntimeConfig): string {
  if (config.databaseUrl === undefined) {
    throw new Error("DATABASE_URL is required when TETHER_MIGRATE_POSTGRES=1.");
  }
  return config.databaseUrl;
}
