import { test, expect } from "bun:test";
import { resolveToolPolicy, canApprove, summarizeTool } from "../src/core/permissions";

test("resolveToolPolicy by mode and tool", () => {
  expect(resolveToolPolicy("bypassPermissions", "Bash")).toBe("allow");
  expect(resolveToolPolicy("default", "Read")).toBe("allow");
  expect(resolveToolPolicy("default", "Bash")).toBe("ask");
  expect(resolveToolPolicy("default", "Edit")).toBe("ask");
  expect(resolveToolPolicy("acceptEdits", "Edit")).toBe("allow");
  expect(resolveToolPolicy("acceptEdits", "Bash")).toBe("ask");
});

test("canApprove gating", () => {
  expect(canApprove({ clickerRoleIds: [], approverRoleIds: [], isStarter: true })).toBe(true);
  expect(canApprove({ clickerRoleIds: [], approverRoleIds: [], isStarter: false })).toBe(true); // none configured
  expect(canApprove({ clickerRoleIds: ["r1"], approverRoleIds: ["r1"], isStarter: false })).toBe(true);
  expect(canApprove({ clickerRoleIds: ["r2"], approverRoleIds: ["r1"], isStarter: false })).toBe(false);
});

test("summarizeTool", () => {
  expect(summarizeTool("Bash", { command: "echo hi" })).toBe("Bash: echo hi");
  expect(summarizeTool("Edit", { file_path: "src/a.ts" })).toBe("Edit: src/a.ts");
  expect(summarizeTool("Glob", {})).toBe("Glob");
});
