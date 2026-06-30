import { test, expect } from "bun:test";
import { runCli, type CliDeps, type IO } from "../src/cli/run";
import { detectClaude, detectGit } from "@ryuzi/core";

function tmpDb(): string {
  return `/tmp/harness-cli-${Bun.hash(Math.random().toString())}.sqlite`;
}
function depsFor(dbPath: string) {
  const lines: string[] = [];
  const io: IO = { out: (s) => lines.push(s), err: (s) => lines.push("ERR " + s), prompt: async () => "" };
  const deps: CliDeps = { io, dbPath, detect: { claude: detectClaude, git: detectGit } };
  return { lines, deps };
}

test("config set then get persists within one db file", async () => {
  const dbPath = tmpDb();
  const { lines, deps } = depsFor(dbPath);
  expect(await runCli(["config", "set", "default_effort", "high"], deps)).toBe(0);
  lines.length = 0;
  expect(await runCli(["config", "get", "default_effort"], deps)).toBe(0);
  expect(lines.join("\n")).toContain("high");
});

test("config set invalid value returns non-zero", async () => {
  const { deps } = depsFor(":memory:");
  expect(await runCli(["config", "set", "default_perm_mode", "bogus"], deps)).toBe(1);
});

test("config list redacts secrets", async () => {
  const dbPath = tmpDb();
  const { lines, deps } = depsFor(dbPath);
  await runCli(["config", "set", "discord.token", "supersecret"], deps);
  lines.length = 0;
  await runCli(["config", "list"], deps);
  const text = lines.join("\n");
  expect(text).toContain("discord.token");
  expect(text).not.toContain("supersecret");
});

test("config list shows defaults and unset keys on fresh db", async () => {
  const dbPath = tmpDb();
  const { lines, deps } = depsFor(dbPath);
  await runCli(["config", "list"], deps);
  const text = lines.join("\n");
  expect(text).toContain("default_effort = medium (default)");
  expect(text).toContain("default_perm_mode = default (default)");
  expect(text).toMatch(/workdir_root = \(unset\)/);
});

test("config usage strings use the ryuzi command name", async () => {
  const { lines, deps } = depsFor(":memory:");
  expect(await runCli(["config", "get"], deps)).toBe(1);
  expect(await runCli(["config", "set", "default_effort"], deps)).toBe(1);
  expect(await runCli(["config", "bogus"], deps)).toBe(1);
  expect(lines.join("\n")).toContain("usage: ryuzi config get <key> [--reveal]");
  expect(lines.join("\n")).toContain("usage: ryuzi config set <key> <value>");
  expect(lines.join("\n")).toContain("usage: ryuzi config <get|set|list> ...");
});

test("unknown commands point to ryuzi help", async () => {
  const { lines, deps } = depsFor(":memory:");
  expect(await runCli(["bogus"], deps)).toBe(1);
  expect(lines.join("\n")).toContain("unknown command: bogus - run `ryuzi --help`");
});
