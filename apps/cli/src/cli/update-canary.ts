import { buildDaemon } from "@harness/core";
import { dirname } from "node:path";
import { readHandoff as realRead, writeHandoff as realWrite, type Handoff } from "./update-handoff";
import { writeStatus } from "./daemon-status";

export interface ProbeDeps {
  openDb: () => unknown;
  version: string;
  targetVersion: string;
}

export function probe(deps: ProbeDeps): { healthy: boolean; detail?: string } {
  if (deps.version !== deps.targetVersion) {
    return { healthy: false, detail: `version mismatch: running ${deps.version}, expected ${deps.targetVersion}` };
  }
  try {
    deps.openDb();
  } catch (e) {
    return { healthy: false, detail: `db open failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { healthy: true };
}

export interface CanaryDeps {
  dir: string;
  dbPath: string;
  version: string;
  targetVersion: string;
  openDb: () => unknown;
  promote: () => Promise<void>;
  writeHandoff?: (h: Handoff) => void;
  readHandoff: () => Handoff | null;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  timeoutMs: number;
}

export async function runCanaryWith(deps: CanaryDeps): Promise<"promoted" | "failed"> {
  const write = deps.writeHandoff ?? ((h: Handoff) => realWrite(deps.dir, h));
  const pid = process.pid;
  write({ phase: "probing", pid, version: deps.version });

  const p = probe({ openDb: deps.openDb, version: deps.version, targetVersion: deps.targetVersion });
  if (!p.healthy) {
    write({ phase: "failed", pid, version: deps.version, detail: p.detail });
    return "failed";
  }
  write({ phase: "healthy", pid, version: deps.version });

  const deadline = deps.now() + deps.timeoutMs;
  while (deps.now() < deadline) {
    const h = deps.readHandoff();
    if (h?.phase === "promote") {
      await deps.promote();
      write({ phase: "promoted", pid, version: deps.version });
      return "promoted";
    }
    await deps.sleep(100);
  }
  write({ phase: "failed", pid, version: deps.version, detail: "promote timeout" });
  return "failed";
}

export async function runCanary(deps: { dbPath: string }): Promise<void> {
  const dir = dirname(deps.dbPath);
  const { version } = await import("./meta");
  const target = process.env.HARNESS_CANARY_TARGET ?? version();
  let daemon: ReturnType<typeof buildDaemon> | undefined;
  const result = await runCanaryWith({
    dir,
    dbPath: deps.dbPath,
    version: version(),
    targetVersion: target,
    openDb: () => {
      daemon = buildDaemon({ dbPath: deps.dbPath });
      return daemon;
    },
    promote: async () => {
      if (!daemon) daemon = buildDaemon({ dbPath: deps.dbPath });
      await daemon.start(); // claims gateways + runs reconcile() (Phase 1) for interrupted sessions
      writeStatus(dir, { pid: process.pid, state: "running", startedAt: Date.now(), version: version() });
    },
    readHandoff: () => realRead(dir),
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    timeoutMs: Number(process.env.HARNESS_CANARY_TIMEOUT_MS ?? "60000"),
  });
  if (result === "failed") {
    process.exit(1);
  }
  // promoted → become the live daemon: block until a signal stops us.
  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));
  await new Promise<never>(() => {});
}
