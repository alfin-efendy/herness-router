import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listDir, readFile } from "../src/core/workspace-files";

function makeWorktree() {
  const root = mkdtempSync(join(tmpdir(), "wt-"));
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, ".git"));
  writeFileSync(join(root, "src", "app.ts"), "export const x = 1;\n");
  writeFileSync(join(root, "README.md"), "# hi\n");
  writeFileSync(join(root, "bin.dat"), Buffer.from([0x00, 0x01, 0x02, 0x00]));
  return root;
}

test("listDir sorts dirs-first, hides .git", () => {
  const root = makeWorktree();
  const entries = listDir(root, "");
  expect(entries.find((e) => e.name === ".git")).toBeUndefined();
  expect(entries.map((e) => `${e.type}:${e.name}`)).toEqual(["dir:src", "file:README.md", "file:bin.dat"]);
  rmSync(root, { recursive: true, force: true });
});

test("readFile returns utf8 text", () => {
  const root = makeWorktree();
  const r = readFile(root, "src/app.ts");
  expect(r).toEqual({ content: "export const x = 1;\n", encoding: "utf8", binary: false, truncated: false });
  rmSync(root, { recursive: true, force: true });
});

test("readFile flags binary as base64", () => {
  const root = makeWorktree();
  const r = readFile(root, "bin.dat");
  expect(r.binary).toBe(true);
  expect(r.encoding).toBe("base64");
  expect(Buffer.from(r.content, "base64")).toEqual(Buffer.from([0x00, 0x01, 0x02, 0x00]));
  rmSync(root, { recursive: true, force: true });
});

test("confinement rejects .. and absolute paths", () => {
  const root = makeWorktree();
  expect(() => readFile(root, "../../etc/passwd")).toThrow();
  expect(() => listDir(root, "..")).toThrow();
  expect(() => readFile(root, "/etc/passwd")).toThrow();
  rmSync(root, { recursive: true, force: true });
});

test("confinement rejects a symlink that escapes the worktree", () => {
  const root = makeWorktree();
  const outside = mkdtempSync(join(tmpdir(), "outside-"));
  writeFileSync(join(outside, "secret.txt"), "secret\n");
  symlinkSync(join(outside, "secret.txt"), join(root, "link.txt"));
  expect(() => readFile(root, "link.txt")).toThrow();
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

test("readFile truncates files over the cap", () => {
  const root = makeWorktree();
  writeFileSync(join(root, "big.txt"), "a".repeat(3 * 1024 * 1024));
  const r = readFile(root, "big.txt");
  expect(r.truncated).toBe(true);
  expect(r.content.length).toBe(2 * 1024 * 1024);
  rmSync(root, { recursive: true, force: true });
});
