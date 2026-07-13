import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const siteProbePath = "site/.tether-release-docs-probe";

export function validateReleaseDocs({ packageJson, docs, gitignore, npmignore, siteIgnored, packedPaths }) {
  const version = packageJson.version;
  const expectedStatus = `<!-- tether-release-status: source=v${version}; github=v1.0.0; npm=unpublished; v2=unreleased -->`;

  check(/^\d+\.\d+\.\d+$/.test(version), "package version must be stable semver");
  for (const doc of docs) {
    check(doc.content.includes(expectedStatus), `${doc.path} must declare source and published release status`);
  }
  check(
    /latest published GitHub release is\s+v1\.0\.0/i.test(docs.find((doc) => doc.path === "README.md")?.content ?? ""),
    "README must identify the latest published GitHub release"
  );
  check(
    !docs.some((doc) => presentsUnreleasedSourceAsPublished(doc.content, version)),
    "documentation must not present an unreleased source contract as published or available"
  );
  check(siteIgnored, ".gitignore must actively ignore the local site workspace");
  check(/^site$/m.test(npmignore), ".npmignore must exclude the local site workspace");
  check(!packageJson.files.includes("site"), "package files must not include the local site workspace");
  check(!packedPaths.some((path) => path === "site" || path.startsWith("site/")), "npm pack must exclude the local site workspace");
}

  if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const docs = ["README.md", "docs/OPERATIONS.md", "docs/RELEASE.md"].map((path) => ({ path, content: readFileSync(path, "utf8") }));
  const packedPaths = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json"], { encoding: "utf8" }))[0].files.map((file) => file.path);
  const siteIgnored = gitIgnores(siteProbePath);
  validateReleaseDocs({
    packageJson,
    docs,
    gitignore: readFileSync(".gitignore", "utf8"),
    npmignore: readFileSync(".npmignore", "utf8"),
    siteIgnored,
    packedPaths
  });
  console.log(`Release documentation and site-boundary check passed for TETHER v${packageJson.version}.`);
}

function gitIgnores(path) {
  try {
    execFileSync("git", ["check-ignore", "--no-index", "-q", path], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function presentsUnreleasedSourceAsPublished(markdown, version) {
  const content = markdown.replace(/\s+/g, " ");
  const escapedVersion = version.replaceAll(".", "\\.");
  const sourceVersion = `v?${escapedVersion}`;
  return [
    new RegExp(`\\b${sourceVersion}\\b[^.]{0,120}\\b(?:is|was|has been)\\b[^.]{0,80}\\b(?:released|published|available|current|latest|stable|supported)\\b`, "i"),
    new RegExp(`\\b${sourceVersion}\\b[^.]{0,80}\\b(?:GitHub|npm)\\s+(?:release|package)[^.]{0,80}\\b(?:is|was|has been)\\b[^.]{0,80}\\b(?:released|published|available|current|latest|stable|supported)\\b`, "i"),
    new RegExp(`\\b(?:current|latest|supported|stable)(?:\\s+\\w+){0,4}\\s*:\\s*(?:TETHER\\s+)?${sourceVersion}\\b`, "i")
  ].some((pattern) => pattern.test(content));
}

function check(condition, message) {
  if (!condition) throw new Error(`RELEASE DOCS CHECK FAIL: ${message}`);
}
