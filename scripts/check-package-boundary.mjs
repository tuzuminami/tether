import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const workspace = mkdtempSync(join(tmpdir(), "tether-package-boundary-"));
let tarball;

try {
  const packed = JSON.parse(execFileSync("npm", ["pack", "--json"], {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  }));
  const filename = packed[0]?.filename;
  assert.equal(typeof filename, "string", "npm pack did not produce a tarball");
  tarball = join(packageRoot, filename);

  execFileSync("npm", ["install", "--ignore-scripts", "--no-package-lock", "--no-save", tarball], {
    cwd: workspace,
    stdio: "ignore"
  });

  const packageDir = join(workspace, "node_modules", "@tuzuminami", "tether");
  const rootKeys = JSON.parse(execFileSync(process.execPath, [
    "--input-type=module",
    "--eval",
    "console.log(JSON.stringify(Object.keys(await import('@tuzuminami/tether'))))"
  ], {
    cwd: workspace,
    encoding: "utf8"
  }));
  for (const forbiddenExport of ["createDevelopmentContext", "createDefaultApiRuntime", "developmentBearerAuthenticator"]) {
    assert.equal(rootKeys.includes(forbiddenExport), false, `forbidden root export: ${forbiddenExport}`);
  }

  for (const file of listPackageCode(join(packageDir, "dist"))) {
    const source = readFileSync(file, "utf8");
    for (const forbiddenIdentifier of ["createDevelopmentContext", "createDefaultApiRuntime", "developmentBearerAuthenticator", "dev-token", "dev-token-actor"]) {
      assert.equal(source.includes(forbiddenIdentifier), false, `forbidden package identifier ${forbiddenIdentifier} in ${file}`);
    }
  }

  for (const deepPath of [
    "@tuzuminami/tether/dist/http-api.js",
    "@tuzuminami/tether/dist/relationship-engine.js",
    "@tuzuminami/tether/apps/api/server.mjs"
  ]) {
    assertDeepImportBlocked(workspace, deepPath);
  }
  console.log("package-boundary: passed");
} finally {
  if (tarball !== undefined) rmSync(tarball, { force: true });
  rmSync(workspace, { recursive: true, force: true });
}

function assertDeepImportBlocked(cwd, specifier) {
  try {
    execFileSync(process.execPath, ["--input-type=module", "--eval", `await import(${JSON.stringify(specifier)})`], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    if (error?.stderr?.includes?.("ERR_PACKAGE_PATH_NOT_EXPORTED")) return;
    throw error;
  }
  assert.fail(`unexpected deep import success: ${specifier}`);
}

function listPackageCode(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listPackageCode(path);
    if (entry.isFile() && (path.endsWith(".js") || path.endsWith(".d.ts"))) return [path];
    return [];
  });
}
