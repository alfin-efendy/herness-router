import { test, expect } from "bun:test";
import { GLOBAL_FIELDS } from "../../src/config/schema";
import { openDb } from "../../src/store/db";
import { SettingsStore } from "../../src/config/store";

test("auto_update defaults resolve", () => {
  const s = new SettingsStore(openDb(":memory:"));
  expect(s.get("auto_update")).toBe("auto");
  expect(s.get("auto_update_check_interval_ms")).toBe("21600000");
  expect(s.get("auto_update_drain_timeout_ms")).toBe("300000");
  expect(s.get("auto_update_canary_timeout_ms")).toBe("60000");
  expect(s.get("auto_update_repo")).toBe("alfin-efendy/ryuzi");
});

test("auto_update_repo help text keeps harness-default wording", () => {
  expect(GLOBAL_FIELDS.find((f) => f.key === "auto_update_repo")?.help).toBe("blank = harness default");
});

test("auto_update validates its enum, the timeouts are ints", () => {
  const s = new SettingsStore(openDb(":memory:"));
  s.set("auto_update", "notify"); // ok
  expect(s.get("auto_update")).toBe("notify");
  expect(() => s.set("auto_update", "bogus")).toThrow(/one of/);
  expect(() => s.set("auto_update_check_interval_ms", "soon")).toThrow(/integer/);
});

test("last_notified_version is settable (internal dedupe key)", () => {
  const s = new SettingsStore(openDb(":memory:"));
  expect(s.get("last_notified_version")).toBeUndefined();
  s.set("last_notified_version", "0.3.0");
  expect(s.get("last_notified_version")).toBe("0.3.0");
});
