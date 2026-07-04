#!/usr/bin/env node
import { createDefaultApiRuntime } from "../../src/http-api.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const { server } = createDefaultApiRuntime();

server.listen(port, "0.0.0.0", () => {
  console.log(`tether api listening on ${port}`);
});
