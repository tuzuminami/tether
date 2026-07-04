#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

for (const entry of readdirSync("src", { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".js")) {
    continue;
  }
  cpSync(join("src", entry.name), join("dist", entry.name));
}

const cliPath = join("dist", "cli.js");
const cli = readFileSync(cliPath, "utf8");
writeFileSync(cliPath, cli.startsWith("#!") ? cli : `#!/usr/bin/env node\n${cli}`);

console.log("build: copied JavaScript sources to dist");
