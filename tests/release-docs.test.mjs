import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import test from "node:test";
import { validateReleaseDocs } from "../scripts/check-release-docs.mjs";

const status = "<!-- tether-release-status: source=v2.0.0; github=v1.0.0; npm=unpublished; v2=unreleased -->";
const docs = (readme) => [
  { path: "README.md", content: `${status}\n${readme}` },
  { path: "docs/OPERATIONS.md", content: `${status}\nTETHER v2.0.0 is unreleased source deployment contract.` },
  { path: "docs/RELEASE.md", content: `${status}\nTETHER v2.0.0 compatibility.` }
];
const base = (overrides = {}) => ({
  packageJson: { version: "2.0.0", files: ["dist"] },
  docs: docs("The latest published GitHub release is v1.0.0. v2.0.0 has not been released."),
  gitignore: "/site/\n",
  npmignore: "site\n",
  siteIgnored: true,
  packedPaths: ["README.md"],
  ...overrides
});

test("release documentation permits an unreleased source contract with an explicit published release", () => {
  assert.doesNotThrow(() => validateReleaseDocs(base()));
});

test("release documentation rejects an unreleased source contract presented as public", () => {
  assert.throws(
    () => validateReleaseDocs(base({ docs: docs("TETHER v2.0.0 is the supported public release.") })),
    /must identify the latest published GitHub release|must not present an unreleased source contract/
  );
});

test("release documentation rejects an unreleased source contract presented as available", () => {
  const available = docs("The latest published GitHub release is v1.0.0. v2.0.0 GitHub release is now available.");
  assert.throws(() => validateReleaseDocs(base({ docs: available })), /must not present an unreleased source contract/);
});

test("release documentation rejects a site workspace that is not actively ignored or excluded from a pack", () => {
  assert.throws(() => validateReleaseDocs(base({ siteIgnored: false })), /actively ignore/);
  assert.throws(() => validateReleaseDocs(base({ packedPaths: ["site/index.html"] })), /npm pack must exclude/);
});

test("release-document runner preserves an existing local site workspace", () => {
  const marker = `site/.release-docs-preserve-${process.pid}`;
  const createdSiteDirectory = !existsSync("site");
  mkdirSync("site", { recursive: true });
  writeFileSync(marker, "must remain after validation\n");

  try {
    execFileSync(process.execPath, ["scripts/check-release-docs.mjs"], { stdio: "pipe" });
    assert.equal(readFileSync(marker, "utf8"), "must remain after validation\n");
  } finally {
    rmSync(marker, { force: true });
    if (createdSiteDirectory) rmdirSync("site");
  }
});
