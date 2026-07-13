import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { relative } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createConfiguredApiRuntime, resolveTetherApiRuntimeConfig } from "../dist/index.js";

test("TEST-RUNTIME-001 resolves the explicit in-memory HTTP runtime config", () => {
  assert.deepEqual(resolveTetherApiRuntimeConfig({ PORT: "4100", TETHER_BIND_HOST: "127.0.0.1", TETHER_RUNTIME_STORE: "memory", TETHER_AUTH_ADAPTER: "test-auth-adapter" }), {
    port: 4100,
    bindHost: "127.0.0.1",
    runtimeStore: "memory",
    migratePostgres: false,
    production: false,
    authAdapter: "test-auth-adapter"
  });
});

test("TEST-RUNTIME-002 applies PostgreSQL migrations before starting the memory runtime", async () => {
  const calls = [];
  const runtime = await createConfiguredApiRuntime({
    env: {
      PORT: "4101",
      TETHER_BIND_HOST: "127.0.0.1",
      TETHER_RUNTIME_STORE: "memory",
      TETHER_MIGRATE_POSTGRES: "1",
      DATABASE_URL: "postgres://tether:test@127.0.0.1:5432/tether",
      TETHER_AUTH_ADAPTER: "test-auth-adapter"
    },
    createPostgresStore(databaseUrl) {
      calls.push(["create", databaseUrl]);
      return {
        async migrate() {
          calls.push(["migrate"]);
        },
        async checkReadiness() {
          calls.push(["ready"]);
        },
        async close() {
          calls.push(["close"]);
        }
      };
    },
    async loadAuthenticator() { return { authenticate: () => ({ tenantId: "tenant_test", actorId: "actor_test", scopes: [], correlationId: "corr_test" }) }; }
  });

  runtime.server.close();
  assert.deepEqual(calls, [
    ["create", "postgres://tether:test@127.0.0.1:5432/tether"],
    ["migrate"],
    ["close"]
  ]);
  assert.equal(runtime.config.runtimeStore, "memory");
});

test("TEST-RUNTIME-003 wires the PostgreSQL HTTP runtime only with a verified auth adapter", async () => {
  const calls = [];
  const runtime = await createConfiguredApiRuntime({
    env: {
      TETHER_RUNTIME_STORE: "postgres",
      TETHER_BIND_HOST: "0.0.0.0",
      TETHER_MIGRATE_POSTGRES: "1",
      DATABASE_URL: "postgres://tether:test@127.0.0.1:5432/tether",
      TETHER_AUTH_ADAPTER: "test-auth-adapter"
    },
    createPostgresStore() {
      return { async migrate() { calls.push("migrate"); }, async checkReadiness() { calls.push("ready"); }, async close() { calls.push("close"); } };
    },
    async loadAuthenticator(moduleSpecifier) {
      calls.push(moduleSpecifier);
      return { authenticate: () => ({ tenantId: "tenant_test", actorId: "actor_test", scopes: [], correlationId: "corr_test" }) };
    }
  });
  runtime.server.close();
  assert.equal(runtime.config.runtimeStore, "postgres");
  assert.deepEqual(calls, ["migrate", "test-auth-adapter"]);
  assert.throws(
    () => resolveTetherApiRuntimeConfig({ TETHER_RUNTIME_STORE: "postgres", TETHER_BIND_HOST: "0.0.0.0", DATABASE_URL: "postgres://example" }),
    /requires TETHER_MIGRATE_POSTGRES=1/
  );
});

test("TEST-RUNTIME-004 rejects invalid runtime config before server startup", async () => {
  assert.throws(() => resolveTetherApiRuntimeConfig({ PORT: "0" }), /PORT must be an integer/);
  assert.throws(() => resolveTetherApiRuntimeConfig({}), /TETHER_RUNTIME_STORE must be set explicitly/);
  assert.throws(() => resolveTetherApiRuntimeConfig({ TETHER_RUNTIME_STORE: "memory" }), /TETHER_BIND_HOST must be set explicitly/);
  assert.throws(() => resolveTetherApiRuntimeConfig({ TETHER_RUNTIME_STORE: "sqlite" }), /TETHER_RUNTIME_STORE/);
  assert.throws(
    () => resolveTetherApiRuntimeConfig({ TETHER_RUNTIME_STORE: "memory", TETHER_BIND_HOST: "127.0.0.1", TETHER_MIGRATE_POSTGRES: "true" }),
    /TETHER_MIGRATE_POSTGRES/
  );
  await assert.rejects(
    () => createConfiguredApiRuntime({ env: { TETHER_RUNTIME_STORE: "memory", TETHER_BIND_HOST: "127.0.0.1", TETHER_MIGRATE_POSTGRES: "1", TETHER_AUTH_ADAPTER: "test-auth-adapter" } }),
    /DATABASE_URL/
  );
});

test("TEST-RUNTIME-005 closes the PostgreSQL pool when migration readiness or adapter loading fails", async () => {
  const calls = [];
  await assert.rejects(
    () =>
      createConfiguredApiRuntime({
        env: { TETHER_RUNTIME_STORE: "postgres", TETHER_BIND_HOST: "0.0.0.0", TETHER_MIGRATE_POSTGRES: "1", DATABASE_URL: "postgres://example", TETHER_AUTH_ADAPTER: "broken" },
        createPostgresStore: () => ({ async migrate() { calls.push("migrate"); }, async checkReadiness() { calls.push("ready"); }, async close() { calls.push("close"); } }),
        async loadAuthenticator() { throw new Error("adapter unavailable"); }
      }),
    /adapter unavailable/
  );
  assert.deepEqual(calls, ["migrate", "close"]);
});

test("TEST-RUNTIME-006 resolves relative auth adapter paths from the process cwd", async (t) => {
  const directory = await mkdtemp(`${tmpdir()}/tether-auth-adapter-`);
  const adapter = `${directory}/adapter.mjs`;
  await writeFile(
    adapter,
    "export function authenticateTetherRequest({ tenantId, correlationId }) { return { tenantId, actorId: 'adapter-actor', scopes: [], correlationId }; }\n"
  );
  t.after(async () => rm(directory, { recursive: true, force: true }));

  const runtime = await createConfiguredApiRuntime({
    env: {
      TETHER_RUNTIME_STORE: "postgres",
      TETHER_BIND_HOST: "0.0.0.0",
      TETHER_MIGRATE_POSTGRES: "1",
      DATABASE_URL: "postgres://tether:test@127.0.0.1:5432/tether",
      TETHER_AUTH_ADAPTER: relative(process.cwd(), adapter)
    },
    createPostgresStore: () => ({ async migrate() {}, async checkReadiness() {}, async close() {} })
  });
  runtime.server.close();
  assert.equal(runtime.config.authAdapter, relative(process.cwd(), adapter));
});

test("TEST-RUNTIME-007 requires an adapter for memory runtime and rejects removed development auth", () => {
  assert.throws(
    () => resolveTetherApiRuntimeConfig({ TETHER_RUNTIME_STORE: "memory", TETHER_BIND_HOST: "0.0.0.0" }),
    /TETHER_AUTH_ADAPTER is required/
  );
  assert.throws(
    () => resolveTetherApiRuntimeConfig({ TETHER_RUNTIME_STORE: "memory", TETHER_BIND_HOST: "127.0.0.1", TETHER_AUTH_ADAPTER: "test", TETHER_DEVELOPMENT_AUTH: "1" }),
    /not supported/
  );
});
