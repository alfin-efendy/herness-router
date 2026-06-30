import { test, expect } from "bun:test";
import { canaryTargetVersion, canaryTimeoutMs, probe, runCanaryWith, type CanaryDeps } from "../../src/cli/update-canary";
import type { Handoff } from "../../src/cli/update-handoff";

const legacyBrandEnv = "HAR" + "NESS";

test("probe is healthy when version matches and db opens", () => {
  expect(probe({ openDb: () => ({}), version: "0.3.0", targetVersion: "0.3.0" })).toEqual({ healthy: true });
});

test("probe fails on version mismatch", () => {
  const r = probe({ openDb: () => ({}), version: "0.2.0", targetVersion: "0.3.0" });
  expect(r.healthy).toBe(false);
  expect(r.detail).toMatch(/version/i);
});

test("probe fails when db cannot open", () => {
  const r = probe({
    openDb: () => {
      throw new Error("locked");
    },
    version: "0.3.0",
    targetVersion: "0.3.0",
  });
  expect(r.healthy).toBe(false);
  expect(r.detail).toMatch(/db|locked/i);
});

test("canary target version reads RYUZI_CANARY_TARGET", () => {
  expect(canaryTargetVersion("0.2.0", { RYUZI_CANARY_TARGET: "0.3.0", [`${legacyBrandEnv}_CANARY_TARGET`]: "0.4.0" })).toBe("0.3.0");
  expect(canaryTargetVersion("0.2.0", {})).toBe("0.2.0");
});

test("canary timeout reads RYUZI_CANARY_TIMEOUT_MS and ignores legacy env", () => {
  expect(canaryTimeoutMs({ RYUZI_CANARY_TIMEOUT_MS: "1234", [`${legacyBrandEnv}_CANARY_TIMEOUT_MS`]: "9999" })).toBe(1234);
  expect(canaryTimeoutMs({ [`${legacyBrandEnv}_CANARY_TIMEOUT_MS`]: "9999" })).toBe(60000);
  expect(canaryTimeoutMs({})).toBe(60000);
});

function canaryDeps(
  over: Partial<CanaryDeps>,
  handoffScript: (Handoff | null)[],
): { deps: CanaryDeps; written: Handoff[]; promoted: { count: number } } {
  const written: Handoff[] = [];
  let i = 0;
  const promoted = { count: 0 };
  const deps: CanaryDeps = {
    dir: "/d",
    dbPath: ":memory:",
    version: "0.3.0",
    targetVersion: "0.3.0",
    openDb: () => ({}),
    promote: async () => {
      promoted.count++;
    },
    readHandoff: () => handoffScript[Math.min(i++, handoffScript.length - 1)] ?? null,
    now: () => 0,
    sleep: async () => {},
    timeoutMs: 1000,
    ...over,
  };
  // capture writes by wrapping — the impl calls a writeHandoff dep; see Step 3 for the seam
  deps.writeHandoff = (h) => written.push(h);
  return { deps, written, promoted };
}

test("runCanaryWith: healthy then promote → promotes and returns 'promoted'", async () => {
  const { deps, written, promoted } = canaryDeps({}, [
    { phase: "healthy", pid: 1, version: "0.3.0" },
    { phase: "promote", pid: 1, version: "0.3.0" },
  ]);
  const r = await runCanaryWith(deps);
  expect(r).toBe("promoted");
  expect(promoted.count).toBe(1);
  expect(written.map((h) => h.phase)).toEqual(["probing", "healthy", "promoted"]);
});

test("runCanaryWith: probe failure → writes 'failed', never promotes", async () => {
  const { deps, written, promoted } = canaryDeps({ version: "0.2.0" }, []); // version mismatch
  const r = await runCanaryWith(deps);
  expect(r).toBe("failed");
  expect(promoted.count).toBe(0);
  expect(written.map((h) => h.phase)).toEqual(["probing", "failed"]);
});

test("runCanaryWith: promote never arrives → times out with 'failed', never promotes", async () => {
  let t = 0;
  const { deps, written, promoted } = canaryDeps(
    { now: () => (t += 600) },
    [{ phase: "healthy", pid: 1, version: "0.3.0" }], // readHandoff always returns healthy, never 'promote'
  );
  const r = await runCanaryWith(deps);
  expect(r).toBe("failed");
  expect(promoted.count).toBe(0);
  expect(written.map((h) => h.phase)).toEqual(["probing", "healthy", "failed"]);
  expect(written[written.length - 1]?.detail).toBe("promote timeout");
});
