#!/usr/bin/env node
import { createConfiguredApiRuntime } from "../../dist/index.js";

const { config, server } = await createConfiguredApiRuntime();

server.listen(config.port, "0.0.0.0", () => {
  console.log(`tether api listening on ${config.port} with ${config.runtimeStore} runtime store`);
});
