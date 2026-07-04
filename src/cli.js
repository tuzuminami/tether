import { readFile } from "node:fs/promises";
import { compilePersonaVersion, parsePersonaContract, TetherError } from "./index.js";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = await readFile(args.input, "utf8");
  const contract = parsePersonaContract(JSON.parse(raw));
  const bundle = compilePersonaVersion(
    { contract, status: "published" },
    { compilerVersion: args.compilerVersion, generatedAt: args.generatedAt }
  );
  process.stdout.write(`${JSON.stringify(bundle, null, 2)}\n`);
}

function parseArgs(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (key === undefined || value === undefined || !key.startsWith("--")) {
      usage();
    }
    values.set(key.slice(2), value);
  }

  const input = values.get("input");
  const compilerVersion = values.get("compiler-version") ?? "0.1.0";
  const generatedAt = values.get("generated-at") ?? new Date(0).toISOString();

  if (input === undefined) {
    usage();
  }

  return { input, compilerVersion, generatedAt };
}

function usage() {
  process.stderr.write("Usage: tether --input contract.json [--compiler-version 0.1.0] [--generated-at ISO_TIME]\n");
  process.exit(2);
}

main().catch((error) => {
  if (error instanceof TetherError) {
    process.stderr.write(`${error.code}: ${error.message}\n${error.details.join("\n")}\n`);
    process.exit(1);
  }
  process.stderr.write(error instanceof Error ? `${error.message}\n` : "Unknown error\n");
  process.exit(1);
});
