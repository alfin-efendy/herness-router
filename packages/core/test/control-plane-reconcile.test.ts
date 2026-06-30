import { test, expect } from "bun:test";
import type { Agent, AgentEvent, AgentRunInput } from "../src/agents/types";
import { openDb } from "../src/store/db";
import { ProjectsStore } from "../src/store/projects";
import { SessionsStore } from "../src/store/sessions";
import { SettingsStore } from "../src/config/store";
import { ControlPlane } from "../src/core/control-plane";

const resumed: string[] = [];
class CapHarness implements Agent {
  readonly id = "claude-code";
  async *run(i: AgentRunInput): AsyncIterable<AgentEvent> {
    if (i.resume) resumed.push(i.resume);
    yield { type: "result", usage: {} };
  }
}

test("reconcile resumes running sessions with an agentSessionId, idles those without", async () => {
  resumed.length = 0;
  const db = openDb(":memory:");
  const projects = new ProjectsStore(db);
  projects.insert({ projectId: "p1", name: "foo", workdir: "/repo/foo", harness: "claude-code", permMode: "default" });
  const sessions = new SessionsStore(db);
  const cp = new ControlPlane({
    projects,
    sessions,
    settings: new SettingsStore(db),
    workdirRoot: "/root",
    worktree: { pathFor: (r, p, s) => `${r}/${p}/${s}`, create: async () => {}, remove: async () => {} },
  });
  cp.harnesses.register("claude-code", () => new CapHarness());
  sessions.insert({ sessionPk: "s1", projectId: "p1", agentSessionId: "a1", worktreePath: "/wt", status: "running" });
  sessions.insert({ sessionPk: "s2", projectId: "p1", worktreePath: "/wt", status: "running" }); // no agent id
  sessions.insert({ sessionPk: "s3", projectId: "p1", agentSessionId: "a3", worktreePath: "/wt", status: "idle" }); // not stuck

  await cp.reconcile();

  expect(resumed).toEqual(["a1"]); // only s1 resumed
  expect(sessions.get("s1")!.status).toBe("idle"); // resumed then completed
  expect(sessions.get("s2")!.status).toBe("idle"); // idled (no agent id)
  expect(sessions.get("s3")!.status).toBe("idle"); // untouched
});
