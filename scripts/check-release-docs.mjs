import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const version = packageJson.version;
const docs = ["README.md", "docs/OPERATIONS.md", "docs/RELEASE.md"].map((path) => ({ path, content: readFileSync(path, "utf8") }));
const gitignore = readFileSync(".gitignore", "utf8");
const npmignore = readFileSync(".npmignore", "utf8");

check(/^\d+\.\d+\.\d+$/.test(version), "package version must be stable semver");
for (const doc of docs) {
  check(doc.content.includes(`v${version}`), `${doc.path} must identify the current supported release`);
  check(!/\bv0\.[0-9]+\b/i.test(doc.content), `${doc.path} contains stale pre-v1 release language`);
}
check(gitignore.includes("/site/"), ".gitignore must isolate the local site workspace");
check(/^site$/m.test(npmignore), ".npmignore must exclude the local site workspace");
check(!packageJson.files.includes("site"), "package files must not include the local site workspace");

console.log(`Release documentation and site-boundary check passed for TETHER v${version}.`);

function check(condition, message) {
  if (!condition) {
    console.error(`RELEASE DOCS CHECK FAIL: ${message}`);
    process.exit(1);
  }
}
