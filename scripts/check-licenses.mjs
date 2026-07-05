#!/usr/bin/env node
import { readFileSync } from "node:fs";

const lockfile = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const packages = lockfile.packages ?? {};
const denied = /\b(?:AGPL|GPL|LGPL)\b/i;
const missing = [];
const rejected = [];

for (const [path, metadata] of Object.entries(packages)) {
  if (path === "") {
    continue;
  }
  const license = metadata.license;
  if (typeof license !== "string" || license.length === 0) {
    missing.push(path);
    continue;
  }
  if (denied.test(license)) {
    rejected.push(`${path}: ${license}`);
  }
}

if (missing.length > 0 || rejected.length > 0) {
  console.error("license audit failed");
  if (missing.length > 0) {
    console.error(`missing license metadata:\n${missing.join("\n")}`);
  }
  if (rejected.length > 0) {
    console.error(`rejected licenses:\n${rejected.join("\n")}`);
  }
  process.exit(1);
}

console.log(`license audit: ok (${Object.keys(packages).length - 1} dependencies scanned)`);
