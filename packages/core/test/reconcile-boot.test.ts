import { test, expect } from "bun:test";
import type { Agent, AgentEvent, AgentRunInput } from "../src/agents/types";
import type { RuntimeDescriptor } from "../src/providers/types";
import { openDb } from "../src/store/db";
import { ProjectsStore } from "../src/store/projects";
import { SessionsStore } from "../src/store/sessions";
import { SettingsStore } from "../src/config/store";
import { makeCatalog } from "../src/providers/catalog";
import { buildDaemon } from "../src/daemon";

const resumed: string[] = [];
class FakeHarness implements Agent {
  readonly id = "claude-code";
  async *run(i: AgentRunInput): AsyncIterable<AgentEvent> {
    if (i.resume) resumed.push(i.resume);
    yield { type: "result", usage: {} };
  }
}

const fakeRuntime: RuntimeDescriptor = {
  id: "claude-code",
  label: "Fake",
  description: "fake runtime for tests",
  kind: "runtime",
  fields: [],
  detect: async () => ({ found: true }),
  build: () => new FakeHarness(),
};

test("buildDaemon().start() reconciles leftover running sessions", async () => {
  resumed.length = 0;
  const db = openDb(":memory:");
  const settings = new SettingsStore(db);
  settings.set("workdir_root", "/root");
  settings.set("enabled_runtimes", "claude-code");
  // enabled_gateways left unset → no gateways to start
  const projects = new ProjectsStore(db);
  projects.insert({ projectId: "p1", name: "foo", workdir: "/repo/foo", harness: "claude-code", permMode: "default" });
  const sessions = new SessionsStore(db);
  sessions.insert({ sessionPk: "s1", projectId: "p1", agentSessionId: "a1", worktreePath: "/wt", status: "running" });

  const daemon = buildDaemon({ dbPath: ":memory:", db, catalog: makeCatalog([], [fakeRuntime]) });
  await daemon.start();
  await new Promise((r) => setTimeout(r, 30)); // let the fire-and-forget reconcile run
  await daemon.stop();

  expect(resumed).toEqual(["a1"]);
});
