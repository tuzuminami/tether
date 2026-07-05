#!/usr/bin/env node
import { createDefaultApiRuntime, PostgresRelationshipStore } from "../../dist/index.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

if (process.env.TETHER_MIGRATE_POSTGRES === "1") {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required when TETHER_MIGRATE_POSTGRES=1");
  }
  const postgres = PostgresRelationshipStore.fromConnectionString(databaseUrl);
  await postgres.migrate();
  await postgres.close();
}

const { server } = createDefaultApiRuntime();

server.listen(port, "0.0.0.0", () => {
  console.log(`tether api listening on ${port}`);
});
