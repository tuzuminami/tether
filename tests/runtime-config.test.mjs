import assert from "node:assert/strict";
import test from "node:test";
import { createConfiguredApiRuntime, resolveTetherApiRuntimeConfig } from "../dist/index.js";

test("TEST-RUNTIME-001 resolves the explicit in-memory HTTP runtime config", () => {
  assert.deepEqual(resolveTetherApiRuntimeConfig({ PORT: "4100", TETHER_RUNTIME_STORE: "memory" }), {
    port: 4100,
    runtimeStore: "memory",
    migratePostgres: false
  });
});

test("TEST-RUNTIME-002 applies PostgreSQL migrations before starting the memory runtime", async () => {
  const calls = [];
  const runtime = await createConfiguredApiRuntime({
    env: {
      PORT: "4101",
      TETHER_RUNTIME_STORE: "memory",
      TETHER_MIGRATE_POSTGRES: "1",
      DATABASE_URL: "postgres://tether:test@127.0.0.1:5432/tether"
    },
    createPostgresStore(databaseUrl) {
      calls.push(["create", databaseUrl]);
      return {
        async migrate() {
          calls.push(["migrate"]);
        },
        async close() {
          calls.push(["close"]);
        }
      };
    }
  });

  runtime.server.close();
  assert.deepEqual(calls, [
    ["create", "postgres://tether:test@127.0.0.1:5432/tether"],
    ["migrate"],
    ["close"]
  ]);
  assert.equal(runtime.config.runtimeStore, "memory");
});

test("TEST-RUNTIME-003 rejects unsupported PostgreSQL HTTP runtime selection fail-closed", async () => {
  let factoryCalled = false;
  await assert.rejects(
    () =>
      createConfiguredApiRuntime({
        env: {
          TETHER_RUNTIME_STORE: "postgres",
          TETHER_MIGRATE_POSTGRES: "1",
          DATABASE_URL: "postgres://tether:test@127.0.0.1:5432/tether"
        },
        createPostgresStore() {
          factoryCalled = true;
          throw new Error("must not be called");
        }
      }),
    /TETHER_RUNTIME_STORE=postgres is fail-closed/
  );
  assert.equal(factoryCalled, false);
});

test("TEST-RUNTIME-004 rejects invalid runtime config before server startup", async () => {
  assert.throws(() => resolveTetherApiRuntimeConfig({ PORT: "0" }), /PORT must be an integer/);
  assert.throws(() => resolveTetherApiRuntimeConfig({}), /TETHER_RUNTIME_STORE must be set explicitly/);
  assert.throws(() => resolveTetherApiRuntimeConfig({ TETHER_RUNTIME_STORE: "sqlite" }), /TETHER_RUNTIME_STORE/);
  assert.throws(
    () => resolveTetherApiRuntimeConfig({ TETHER_RUNTIME_STORE: "memory", TETHER_MIGRATE_POSTGRES: "true" }),
    /TETHER_MIGRATE_POSTGRES/
  );
  await assert.rejects(
    () => createConfiguredApiRuntime({ env: { TETHER_RUNTIME_STORE: "memory", TETHER_MIGRATE_POSTGRES: "1" } }),
    /DATABASE_URL/
  );
});
