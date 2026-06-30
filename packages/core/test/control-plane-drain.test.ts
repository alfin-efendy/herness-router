import { test, expect } from "bun:test";
import type { Agent, AgentEvent, AgentRunInput } from "../src/agents/types";
import { openDb } from "../src/store/db";
import { ProjectsStore } from "../src/store/projects";
import { SessionsStore } from "../src/store/sessions";
import { SettingsStore } from "../src/config/store";
import { ControlPlane } from "../src/core/control-plane";

function setup() {
  const db = openDb(":memory:");
  const projects = new ProjectsStore(db);
  projects.insert({ projectId: "p1", name: "foo", workdir: "/repo/foo", harness: "claude-code", permMode: "default" });
  const cp = new ControlPlane({
    projects,
    sessions: new SessionsStore(db),
    settings: new SettingsStore(db),
    workdirRoot: "/root",
    worktree: { pathFor: (r, p, s) => `${r}/${p}/${s}`, create: async () => {}, remove: async () => {} },
  });
  return { cp };
}

test("drain resolves immediately when nothing is running", async () => {
  const { cp } = setup();
  const t0 = Date.now();
  await cp.drain(1000);
  expect(Date.now() - t0).toBeLessThan(500);
  expect(cp.runningCount()).toBe(0);
});

test("startSession and continueSession reject once draining", async () => {
  const { cp } = setup();
  await cp.drain(10); // sets the latch; nothing running so returns fast
  await expect(cp.startSession({ projectId: "p1", prompt: "x" })).rejects.toThrow(/draining/);
  await expect(cp.continueSession({ sessionPk: "nope", prompt: "x" })).rejects.toThrow(/draining/);
});

test("drain waits for an in-flight turn up to the timeout", async () => {
  const { cp } = setup();
  class Block implements Agent {
    readonly id = "claude-code";
    async *run(i: AgentRunInput): AsyncIterable<AgentEvent> {
      await new Promise<void>((resolve) => i.signal.addEventListener("abort", () => resolve()));
    }
  }
  cp.harnesses.register("claude-code", () => new Block());
  const runP = cp.startSession({ projectId: "p1", prompt: "go" });
  await new Promise((r) => setTimeout(r, 10)); // let the run begin
  expect(cp.runningCount()).toBe(1);
  const t0 = Date.now();
  await cp.drain(200);
  expect(Date.now() - t0).toBeGreaterThanOrEqual(200);
  expect(cp.runningCount()).toBe(1); // still running — drain timed out, did not kill it
  // cleanup: abort the blocked run
  const pk = cp.listSessions("p1")[0]!.sessionPk;
  await cp.stopSession(pk);
  await runP;
});
