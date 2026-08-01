import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import test from "node:test";
import { validateReleaseDocs } from "../scripts/check-release-docs.mjs";

const status = "<!-- tether-release-status: source=v2.0.1; github=v2.0.1; npm=unpublished; v2=released -->";
const docs = (readme) => [
  { path: "README.md", content: `${status}\n${readme}` },
  { path: "docs/OPERATIONS.md", content: `${status}\nTETHER v2.0.1 deployment contract.` },
  { path: "docs/RELEASE.md", content: `${status}\nTETHER v2.0.1 compatibility.` }
];
const base = (overrides = {}) => ({
  packageJson: { version: "2.0.1", files: ["dist"] },
  docs: docs("The current public GitHub release is v2.0.1."),
  gitignore: "/site/\n",
  npmignore: "site\n",
  siteIgnored: true,
  packedPaths: ["README.md"],
  ...overrides
});

test("release documentation permits an explicit released source contract", () => {
  assert.doesNotThrow(() => validateReleaseDocs(base()));
});

test("release documentation rejects a released source contract presented as unreleased", () => {
  assert.throws(
    () => validateReleaseDocs(base({ docs: docs("The current public GitHub release is v2.0.1. TETHER v2.0.1 has not been released.") })),
    /must not present the released source contract as unreleased/
  );
});

test("release documentation rejects alternate unreleased source claims", () => {
  for (const claim of [
    "The current public GitHub release is v2.0.1. v2.0.1 has not been released.",
    "The current public GitHub release is v2.0.1. TETHER v2.0.1 remains unreleased.",
    "The current public GitHub release is v2.0.1. TETHER 2.0.1 is an unreleased source contract."
  ]) {
    assert.throws(() => validateReleaseDocs(base({ docs: docs(claim) })), /must not present the released source contract as unreleased/);
  }
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
