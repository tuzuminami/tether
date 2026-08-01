import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { basename, join, resolve } from "node:path";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const outputDirectory = readOutputDirectory(process.argv.slice(2));

exec("npm", ["run", "build"]);
const packed = JSON.parse(exec("npm", ["pack", "--json", "--pack-destination", outputDirectory]))[0];
if (!packed?.filename) throw new Error("npm pack did not return a tarball filename.");
const tarballPath = join(outputDirectory, packed.filename);
smokeInstalledTarball(tarballPath);
writeEvidence(tarballPath, outputDirectory);
console.log(`Release assets prepared in ${outputDirectory}.`);

function readOutputDirectory(args) {
  const index = args.indexOf("--output-dir");
  if (index === -1 || !args[index + 1]) throw new Error("release-assets: pass --output-dir <empty directory>");
  const directory = resolve(args[index + 1]);
  mkdirSync(directory, { recursive: true });
  return directory;
}

function smokeInstalledTarball(tarballPath) {
  const consumer = mkdtempSync(join(tmpdir(), "tether-release-consumer-"));
  try {
    writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "tether-release-consumer", private: true, type: "module" }, null, 2));
    exec("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarballPath], { cwd: consumer });
    const program = [
      'import assert from "node:assert/strict";',
      'import { InMemoryRelationshipStore, RelationshipService, createConfiguredApiRuntime } from "@tuzuminami/tether";',
      'const context = { tenantId: "tenant_consumer", actorId: "actor_consumer", scopes: ["model:write", "relationship:write", "relationship:read"], subjectRefs: ["subject_consumer"], correlationId: "corr_consumer" };',
      'const service = new RelationshipService(new InMemoryRelationshipStore());',
      'service.createModel(context, { id: "model", version: "1.0.0", axes: [{ id: "trust", min: 0, max: 100, initial: 10 }], events: [{ type: "helpful" }], transitionRules: [{ id: "rule", eventType: "helpful", axis: "trust", delta: 5, reasonCode: "HELPFUL" }], boundaryRules: [], decayRules: [] });',
      'service.createRelationship(context, { id: "relationship", modelId: "model", modelVersion: "1.0.0", subjectRef: "subject_consumer" });',
      'assert.equal(service.applyEvent(context, "relationship", { id: "event", type: "helpful" }, "idempotency").relationship.snapshot.values.trust, 15);',
      'const runtime = await createConfiguredApiRuntime({ env: { PORT: "3000", TETHER_BIND_HOST: "127.0.0.1", TETHER_RUNTIME_STORE: "memory", TETHER_AUTH_ADAPTER: "consumer-adapter" }, async loadAuthenticator() { return { authenticate: ({ tenantId, correlationId }) => ({ tenantId, actorId: "consumer-actor", scopes: ["relationship:read"], subjectRefs: ["subject_consumer"], correlationId }) }; } });',
      'await new Promise((resolve, reject) => { runtime.server.once("error", reject); runtime.server.listen(0, "127.0.0.1", resolve); });',
      'const address = runtime.server.address(); assert.equal(typeof address, "object"); assert.equal((await fetch(`http://127.0.0.1:${address.port}/ready`)).status, 200);',
      'await new Promise((resolve, reject) => runtime.server.close((error) => error ? reject(error) : resolve()));'
    ].join("\n");
    exec("node", ["--input-type=module", "--eval", program], { cwd: consumer });
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
}

function writeEvidence(tarballPath, directory) {
  const sha256 = digest(readFileSync(tarballPath));
  const tarballName = basename(tarballPath);
  writeFileSync(join(directory, "SHA256SUMS"), `${sha256}  ${tarballName}\n`);
  writeFileSync(join(directory, "sbom.cdx.json"), `${JSON.stringify({
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: `urn:uuid:${sha256.slice(0, 8)}-${sha256.slice(8, 12)}-${sha256.slice(12, 16)}-${sha256.slice(16, 20)}-${sha256.slice(20, 32)}`,
    version: 1,
    metadata: { component: { type: "application", name: packageJson.name, version: packageJson.version } },
    components: dependencyComponents()
  }, null, 2)}\n`);
  const commit = exec("git", ["rev-parse", "HEAD"]).trim();
  const repository = exec("git", ["remote", "get-url", "origin"]).trim().replace(/^git@github.com:/, "https://github.com/").replace(/\.git$/, "");
  const provenance = {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{ name: tarballName, digest: { sha256 } }],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: "https://github.com/tuzuminami/tether/.github/workflows/release-evidence.yml",
        externalParameters: { package: packageJson.name, version: packageJson.version },
        internalParameters: {},
        resolvedDependencies: [{ uri: `git+${repository}@${commit}`, digest: { gitCommit: commit } }]
      },
      runDetails: {
        builder: { id: process.env.GITHUB_WORKFLOW_REF ?? "local" },
        metadata: { invocationId: process.env.GITHUB_RUN_ID ?? "local" }
      }
    }
  };
  writeFileSync(join(directory, "provenance.intoto.jsonl"), `${JSON.stringify(provenance)}\n`);
}

function dependencyComponents() {
  const tree = JSON.parse(exec("npm", ["ls", "--omit=dev", "--all", "--json"]));
  const components = new Map();
  function visit(dependencies = {}) {
    for (const [name, value] of Object.entries(dependencies)) {
      if (!value || typeof value !== "object") continue;
      if (typeof value.version === "string") components.set(`${name}@${value.version}`, { type: "library", name, version: value.version });
      visit(value.dependencies);
    }
  }
  visit(tree.dependencies);
  return [...components.values()].sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`));
}

function exec(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}
