import assert from "node:assert/strict";
import test from "node:test";
import { compilePersonaVersion, parsePersonaContract, TetherError } from "../dist/index.js";

const validContract = {
  id: "persona-demo",
  version: "1.0.0",
  displayName: "Demo Persona",
  components: [
    { id: "style", kind: "style", content: "Use concise wording." },
    { id: "boundary", kind: "boundary", content: "Do not claim real-world exclusivity." }
  ],
  policyRefs: ["policy://default/conversation-boundaries"],
  pluginRefs: ["default-renderer"]
};

test("TEST-COMPILE-001 compiles the same contract to the same hash", () => {
  const contract = parsePersonaContract(validContract);
  const options = {
    compilerVersion: "0.1.0",
    generatedAt: "2026-07-05T00:00:00.000Z",
    plugins: [
      {
        name: "default-renderer",
        version: "1.0.0",
        coreApiVersion: "tether.persona-compiler.v1",
        capabilities: ["persona.compile"]
      }
    ]
  };

  const first = compilePersonaVersion({ contract, status: "published" }, options);
  const second = compilePersonaVersion({ contract, status: "published" }, options);

  assert.equal(first.contentHash, second.contentHash);
  assert.equal(first.source.contractId, "persona-demo");
  assert.deepEqual(first.provenance.componentIds, ["boundary", "style"]);
});

test("TEST-VALIDATION-001 rejects invalid contracts", () => {
  assert.throws(
    () => parsePersonaContract({ ...validContract, policyRefs: [], components: [] }),
    (error) =>
      error instanceof TetherError &&
      error.code === "VALIDATION_FAILED" &&
      error.details.includes("components must contain at least one item") &&
      error.details.includes("policyRefs must contain at least one explicit reference")
  );
});

test("TEST-IMMUTABLE-001 refuses draft versions", () => {
  const contract = parsePersonaContract(validContract);
  assert.throws(
    () =>
      compilePersonaVersion(
        { contract, status: "draft" },
        { compilerVersion: "0.1.0", generatedAt: "2026-07-05T00:00:00.000Z" }
      ),
    (error) => error instanceof TetherError && error.code === "VERSION_CONFLICT"
  );
});

test("TEST-PLUGIN-001 unknown plugin refs fail closed", () => {
  const contract = parsePersonaContract(validContract);
  assert.throws(
    () =>
      compilePersonaVersion(
        { contract, status: "published" },
        { compilerVersion: "0.1.0", generatedAt: "2026-07-05T00:00:00.000Z", plugins: [] }
      ),
    (error) => error instanceof TetherError && error.code === "PLUGIN_INCOMPATIBLE"
  );
});
