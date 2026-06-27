import { test, expect } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeShutdown } from "../../src/cli/daemon-process";
import { writeStatus, readStatus } from "../../src/cli/daemon-status";

function dir() { return mkdtempSync(join(tmpdir(), "hr-dproc-")); }

test("makeShutdown stops the daemon, clears status, exits once", async () => {
  const d = dir();
  writeStatus(d, { pid: process.pid, state: "running", startedAt: 1 });
  let stops = 0; let exitCode = -1;
  const shutdown = makeShutdown(d, { stop: async () => { stops++; } }, (c) => { exitCode = c; });
  await shutdown();
  expect(stops).toBe(1);
  expect(readStatus(d)).toBeNull();
  expect(exitCode).toBe(0);
  await shutdown(); // idempotent
  expect(stops).toBe(1);
});
