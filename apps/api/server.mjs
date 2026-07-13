#!/usr/bin/env node
import { createConfiguredApiRuntime } from "../../dist/index.js";

const { config, server } = await createConfiguredApiRuntime();

server.listen(config.port, config.bindHost, () => {
  console.log(`tether api listening on ${config.bindHost}:${config.port} with ${config.runtimeStore} runtime store`);
});
