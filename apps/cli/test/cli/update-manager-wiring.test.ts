import { test, expect } from "bun:test";
import { buildDaemon, openDb, SettingsStore } from "@harness/core";

test("buildDaemon exposes the settings store so the daemon can read auto_update_*", () => {
  const db = openDb(":memory:");
  new SettingsStore(db).set("auto_update", "notify");
  const daemon = buildDaemon({ dbPath: ":memory:", db });
  expect(daemon.settings).toBeInstanceOf(SettingsStore);
  expect(daemon.settings.get("auto_update")).toBe("notify");
  void daemon.stop();
});
