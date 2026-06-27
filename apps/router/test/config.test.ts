import { test, expect } from "bun:test";
import { openDb } from "../src/store/db";
import { SettingsStore } from "../src/config/store";
import { validateSetting } from "../src/config/schema";

test("validateSetting rejects unknown key", () => {
  expect(validateSetting("nope", "x")).toMatch(/unknown setting/i);
});

test("validateSetting enforces oneOf and int", () => {
  expect(validateSetting("default_perm_mode", "bogus")).toMatch(/one of/i);
  expect(validateSetting("default_perm_mode", "acceptEdits")).toBeNull();
  expect(validateSetting("max_concurrent_runs", "abc")).toMatch(/integer/i);
  expect(validateSetting("max_concurrent_runs", "5")).toBeNull();
});

test("SettingsStore set/get/list and missingRequired", () => {
  const store = new SettingsStore(openDb(":memory:"));
  expect(store.get("discord_token")).toBeUndefined();
  store.set("discord_token", "abc");
  expect(store.get("discord_token")).toBe("abc");
  expect(store.list().discord_token).toBe("abc");
  expect(store.missingRequired()).toContain("workdir_root");
  expect(store.missingRequired()).not.toContain("discord_token");
});

test("SettingsStore set rejects invalid value", () => {
  const store = new SettingsStore(openDb(":memory:"));
  expect(() => store.set("default_perm_mode", "bogus")).toThrow();
});
