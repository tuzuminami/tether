import type { Server } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createTetherHttpServer, type TetherAuthenticator } from "./http-api.js";
import { PostgresRelationshipStore } from "./postgres-store.js";
import { PostgresRelationshipService } from "./postgres-relationship-service.js";
import { InMemoryRelationshipStore, RelationshipService } from "./relationship-engine.js";

export type TetherRuntimeStore = "memory" | "postgres";

export interface TetherApiRuntimeConfig {
  port: number;
  bindHost: string;
  runtimeStore: TetherRuntimeStore;
  migratePostgres: boolean;
  databaseUrl?: string;
  authAdapter?: string;
  production: boolean;
}

export interface TetherConfiguredApiRuntime {
  config: TetherApiRuntimeConfig;
  store: InMemoryRelationshipStore | PostgresRelationshipStore;
  service: RelationshipService | PostgresRelationshipService;
  server: Server;
}

export interface TetherApiRuntimeEnvironment {
  PORT?: string | undefined;
  TETHER_BIND_HOST?: string | undefined;
  TETHER_RUNTIME_STORE?: string | undefined;
  TETHER_MIGRATE_POSTGRES?: string | undefined;
  DATABASE_URL?: string | undefined;
  TETHER_AUTH_ADAPTER?: string | undefined;
  NODE_ENV?: string | undefined;
}

interface MigratingPostgresStore {
  migrate(): Promise<void>;
  checkReadiness(): Promise<void>;
  close(): Promise<void>;
}

export interface CreateConfiguredApiRuntimeOptions {
  env?: TetherApiRuntimeEnvironment | undefined;
  createPostgresStore?: ((databaseUrl: string) => MigratingPostgresStore) | undefined;
  loadAuthenticator?: ((moduleSpecifier: string) => Promise<TetherAuthenticator>) | undefined;
}

export async function createConfiguredApiRuntime(
  options: CreateConfiguredApiRuntimeOptions = {}
): Promise<TetherConfiguredApiRuntime> {
  const config = resolveTetherApiRuntimeConfig(options.env ?? process.env);
  if (config.runtimeStore === "postgres" || config.migratePostgres) {
    const databaseUrl = requireDatabaseUrl(config);
    const createPostgresStore =
      options.createPostgresStore ?? ((url: string): MigratingPostgresStore => PostgresRelationshipStore.fromConnectionString(url));
    const postgres = createPostgresStore(databaseUrl);
    try {
      await postgres.migrate();
    } catch (error) {
      await postgres.close();
      throw error;
    }
    if (config.runtimeStore === "memory") {
      await postgres.close();
      return createMemoryRuntime(config, options.loadAuthenticator);
    }
    let authenticator: TetherAuthenticator;
    try {
      authenticator = await resolveAuthenticator(config, options.loadAuthenticator);
    } catch (error) {
      await postgres.close();
      throw error;
    }
    const store = postgres as PostgresRelationshipStore;
    const service = new PostgresRelationshipService(store);
    return {
      config,
      store,
      service,
      server: createTetherHttpServer({ service, authenticator, readiness: { check: () => store.checkReadiness() } })
    };
  }
  return createMemoryRuntime(config, options.loadAuthenticator);
}

export function resolveTetherApiRuntimeConfig(env: TetherApiRuntimeEnvironment): TetherApiRuntimeConfig {
  const port = parsePort(env.PORT ?? "3000");
  const runtimeStore = parseRuntimeStore(requireRuntimeStore(env.TETHER_RUNTIME_STORE));
  const bindHost = requireBindHost(env.TETHER_BIND_HOST);
  const migratePostgres = parseBooleanFlag(env.TETHER_MIGRATE_POSTGRES ?? "0", "TETHER_MIGRATE_POSTGRES");
  const databaseUrl = normalizeOptional(env.DATABASE_URL);
  const authAdapter = normalizeOptional(env.TETHER_AUTH_ADAPTER);
  const production = env.NODE_ENV === "production";

  if ("TETHER_DEVELOPMENT_AUTH" in env) {
    throw new Error("TETHER_DEVELOPMENT_AUTH is not supported; configure TETHER_AUTH_ADAPTER instead.");
  }
  if (production && (runtimeStore !== "postgres" || !migratePostgres || authAdapter === undefined)) {
    throw new Error("NODE_ENV=production requires postgres runtime, TETHER_MIGRATE_POSTGRES=1, and TETHER_AUTH_ADAPTER.");
  }
  if (runtimeStore === "postgres" && !migratePostgres) {
    throw new Error("TETHER_RUNTIME_STORE=postgres requires TETHER_MIGRATE_POSTGRES=1 for migration readiness checks.");
  }

  if (authAdapter === undefined) {
    throw new Error("TETHER_AUTH_ADAPTER is required for every HTTP runtime.");
  }

  return {
    port,
    bindHost,
    runtimeStore,
    migratePostgres,
    production,
    ...(databaseUrl === undefined ? {} : { databaseUrl }),
    ...(authAdapter === undefined ? {} : { authAdapter })
  };
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

function requireBindHost(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw new Error("TETHER_BIND_HOST must be set explicitly.");
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

async function resolveAuthenticator(
  config: TetherApiRuntimeConfig,
  loadAuthenticator: ((moduleSpecifier: string) => Promise<TetherAuthenticator>) | undefined
): Promise<TetherAuthenticator> {
  if (config.authAdapter === undefined) {
    throw new Error("TETHER_RUNTIME_STORE=postgres requires TETHER_AUTH_ADAPTER exporting authenticateTetherRequest.");
  }
  if (loadAuthenticator !== undefined) return loadAuthenticator(config.authAdapter);
  const moduleSpecifier = resolveAuthAdapterSpecifier(config.authAdapter);
  const loaded = (await import(moduleSpecifier)) as { authenticateTetherRequest?: unknown };
  if (typeof loaded.authenticateTetherRequest !== "function") {
    throw new Error("TETHER_AUTH_ADAPTER must export authenticateTetherRequest.");
  }
  return { authenticate: loaded.authenticateTetherRequest as TetherAuthenticator["authenticate"] };
}

async function createMemoryRuntime(
  config: TetherApiRuntimeConfig,
  loadAuthenticator: ((moduleSpecifier: string) => Promise<TetherAuthenticator>) | undefined
): Promise<TetherConfiguredApiRuntime> {
  const authenticator = await resolveAuthenticator(config, loadAuthenticator);
  const store = new InMemoryRelationshipStore();
  const service = new RelationshipService(store);
  return { config, store, service, server: createTetherHttpServer({ store, service, authenticator }) };
}

function resolveAuthAdapterSpecifier(adapter: string): string {
  if (adapter.startsWith("./") || adapter.startsWith("../") || adapter === "." || adapter === "..") {
    return pathToFileURL(resolve(process.cwd(), adapter)).href;
  }
  return adapter;
}
