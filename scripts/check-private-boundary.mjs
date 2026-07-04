#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const prohibitedPathPatterns = [
  /(^|\/)CODEX(_AI_COMPANION_OSS)?_IMPLEMENTATION_HARNESS\.md$/,
  /(^|\/)(AGENTS\.private\.md|AGENTS_PRIVATE\.md|README_PRIVATE\.md)$/,
  /(^|\/)\.serena(\/|$)/,
  /^docs\/(00_GLOSSARY|01_BMA|02_StRS|03_SyRS|04_AD|05_DD|06_API_CONTRACT|07_VV_PLAN|08_TRACEABILITY|09_MVP_BACKLOG|10_RELEASE_CRITERIA)\.md$/,
  /(^|\/)(private-ai-control-plane|\.private|\.codex-private|evidence-private|private-fixtures)(\/|$)/,
  /^docs\/(ai|private)(\/|$)/,
  /(^|\/)\.env(\.|$)/,
  /\.(sqlite|sqlite3|dump|jsonl)$/i,
  /\.private\.(md|json|ya?ml)$/i
];

const prohibitedContentPatterns = [
  new RegExp(["PRIVATE", "OPERATOR", "MATERIAL"].join("_")),
  new RegExp(["PRIVATE", "SPECIFICATION", "DO", "NOT", "COMMIT"].join("_")),
  new RegExp(["DO", "NOT", "COMMIT", "OR", "PUBLISH"].join("_")),
  new RegExp(["BEGIN", "OPENAI", "PRIVATE", "HARNESS"].join(" "))
];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function fail(message) {
  console.error(`private-boundary: ${message}`);
  process.exit(1);
}

let files;
try {
  const tracked = git(["ls-files"]).filter((file) => !git(["ls-files", "--deleted"]).includes(file));
  const stagedEntries = git(["diff", "--cached", "--name-status"])
    .map((line) => {
      const [status, file] = line.split(/\s+/, 2);
      return status === "D" ? undefined : file;
    })
    .filter((file) => file !== undefined);
  files = [...new Set([...tracked, ...stagedEntries])];
} catch (error) {
  fail(`cannot inspect git files: ${error instanceof Error ? error.message : String(error)}`);
}

const rejected = files.filter((file) => prohibitedPathPatterns.some((pattern) => pattern.test(file)));
if (rejected.length > 0) {
  fail(`prohibited tracked/staged paths: ${rejected.join(", ")}`);
}

for (const file of files) {
  try {
    const body = readFileSync(file, "utf8");
    if (prohibitedContentPatterns.some((pattern) => pattern.test(body))) {
      fail(`prohibited private marker found in ${file}`);
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code !== "ENOENT" && code !== "EISDIR") {
      fail(`cannot scan ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

console.log(`private-boundary: ok (${files.length} tracked/staged files scanned)`);
