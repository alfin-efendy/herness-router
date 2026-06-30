import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

const root = process.cwd();
const skippedDirs = new Set([
  ".git",
  ".agents",
  ".claude",
  ".cache",
  ".superpowers",
  "coverage",
  "dist",
  "logs",
  "node_modules",
  "out",
  "target",
]);

const skippedSubtrees = new Set([
  "docs/superpowers",
]);

const skippedFiles = new Set([
  "apps/cli/CHANGELOG.md",
  "scripts/test/brand-identity.test.ts",
]);

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".lock",
  ".md",
  ".rs",
  ".sh",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const textFilenames = new Set([
  ".gitignore",
  "Dockerfile",
  "Makefile",
]);

const oldIdentityPatterns: Array<[string, RegExp]> = [
  ["Harness Router", /Harness Router/],
  ["harness-router", /harness-router/],
  ["harness-monorepo", /harness-monorepo/],
  ["harness CLI", /\bharness CLI\b/i],
  ["@harness scope", /@harness\//],
  ["hrctl package", /hrctl/],
  ["homebrew-harness tap", /homebrew-harness/],
  ["scoop-harness bucket", /scoop-harness/],
  ["HR installer env", /\bHR_[A-Z0-9_]+\b/],
  ["hr command token", /(?:`hr(?:\.exe)?`|\bhr(?:\.exe)?\s+(?:doctor|run|config|--help|--version)|(?:^|[\s"'=:])hr(?:\.exe)?(?:[\s"',)]|$))/],
  ["old hr binary path", /(?:^|[\s"'=:])(?:[A-Za-z]:[\\/]+|\.{1,2}[\\/]+|[\\/]+|[A-Za-z0-9_$.*-]+[\\/]+)(?:[A-Za-z0-9_$.*-]+[\\/]+)*hr(?:\.exe)?(?=$|[\s"',)\\])/],
  [".hr canary", /\.hr\.canary/],
];

function shouldSkipRel(rel: string): boolean {
  if (skippedFiles.has(rel)) return true;
  for (const subtree of skippedSubtrees) {
    if (rel === subtree || rel.startsWith(`${subtree}/`)) return true;
  }
  return false;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (skippedDirs.has(entry)) continue;
    const path = join(dir, entry);
    const rel = relative(root, path).split(sep).join("/");
    if (shouldSkipRel(rel)) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...walk(path));
      continue;
    }
    const extIndex = rel.lastIndexOf(".");
    const ext = extIndex === -1 ? "" : rel.slice(extIndex);
    if (!textExtensions.has(ext) && !textFilenames.has(basename(path))) continue;
    out.push(path);
  }
  return out;
}

test("active source no longer exposes the old product identity", () => {
  const matches: string[] = [];
  for (const path of walk(root)) {
    const rel = relative(root, path).split(sep).join("/");
    const text = readFileSync(path, "utf8");
    for (const [label, pattern] of oldIdentityPatterns) {
      const match = pattern.exec(text);
      if (match) {
        const line = text.slice(0, match.index).split(/\r?\n/).length;
        matches.push(`${rel}:${line}: ${label}`);
      }
    }
  }
  expect(matches).toEqual([]);
});
