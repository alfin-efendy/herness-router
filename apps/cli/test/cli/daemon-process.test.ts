import { test, expect } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, SettingsStore } from "@ryuzi/core";
import {
  createDaemonUpdateManager,
  daemonUpdateManagerHome,
  makeShutdown,
  startWithTimeout,
  type DaemonUpdateManagerDeps,
} from "../../src/cli/daemon-process";
import { writeStatus, readStatus } from "../../src/cli/daemon-status";

function dir() {
  return mkdtempSync(join(tmpdir(), "hr-dproc-"));
}

test("makeShutdown stops the daemon, clears status, exits once", async () => {
  const d = dir();
  writeStatus(d, { pid: process.pid, state: "running", startedAt: 1 });
  let stops = 0;
  let exitCode = -1;
  const shutdown = makeShutdown(
    d,
    {
      stop: async () => {
        stops++;
      },
    },
    (c) => {
      exitCode = c;
    },
  );
  await shutdown();
  expect(stops).toBe(1);
  expect(readStatus(d)).toBeNull();
  expect(exitCode).toBe(0);
  await shutdown(); // idempotent
  expect(stops).toBe(1);
});

test("startWithTimeout rejects when start hangs", async () => {
  await expect(startWithTimeout({ start: () => new Promise<void>(() => {}) }, 20)).rejects.toThrow(/timed out/);
});

test("startWithTimeout resolves when start resolves", async () => {
  await expect(startWithTimeout({ start: async () => {} }, 1000)).resolves.toBeUndefined();
});

test("daemon update manager constructor path includes the OS home directory", () => {
  let captured: DaemonUpdateManagerDeps | undefined;
  createDaemonUpdateManager({
    cp: { listSessions: () => [], emit: () => {} },
    settings: new SettingsStore(openDb(":memory:")),
    version: "0.2.0",
    execPath: `${daemonUpdateManagerHome()}/.local/bin/ryuzi`,
    compiled: true,
    home: daemonUpdateManagerHome(),
    log: () => {},
    applyUpdate: undefined,
    makeUpdateManager: (deps) => {
      captured = deps;
      return { start: () => {}, stop: () => {} };
    },
  });
  expect(captured?.home).toBe(daemonUpdateManagerHome());
});
