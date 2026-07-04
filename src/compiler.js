import { canonicalJson, sha256Hex } from "./canonical-json.js";
import { TetherError } from "./errors.js";
import { validatePluginRefs } from "./validate.js";

export function compilePersonaVersion(version, options) {
  if (version.status !== "published") {
    throw new TetherError("VERSION_CONFLICT", "Only published persona versions can be compiled.", [
      `status=${version.status}`
    ]);
  }

  validatePluginRefs(version.contract, options.plugins);

  const pluginRefs = [...(version.contract.pluginRefs ?? [])].sort();
  const payload = {
    displayName: version.contract.displayName,
    components: [...version.contract.components].sort((left, right) => left.id.localeCompare(right.id)),
    policyRefs: [...version.contract.policyRefs].sort(),
    pluginRefs
  };

  const sourceMaterial = {
    contract: version.contract,
    compilerVersion: options.compilerVersion
  };
  const sourceHash = sha256Hex(canonicalJson(sourceMaterial));

  const bundleWithoutHash = {
    bundleVersion: "tether.compiled-bundle.v1",
    compilerVersion: options.compilerVersion,
    source: {
      contractId: version.contract.id,
      contractVersion: version.contract.version,
      sourceHash
    },
    generatedAt: options.generatedAt,
    payload,
    provenance: {
      componentIds: payload.components.map((component) => component.id),
      pluginNames: pluginRefs
    }
  };

  const contentHash = sha256Hex(canonicalJson(bundleWithoutHash));
  return {
    ...bundleWithoutHash,
    contentHash
  };
}
