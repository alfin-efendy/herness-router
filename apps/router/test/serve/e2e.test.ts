import { test, expect } from "bun:test";
import { openDb } from "../../src/store/db";
import { ProjectsStore } from "../../src/store/projects";
import { SessionsStore } from "../../src/store/sessions";
import { SettingsStore } from "../../src/config/store";
import { ControlPlane } from "../../src/core/control-plane";
import { startServeServer } from "../../src/serve/index";
import { FakeHarness } from "../helpers/fake-harness";
import { createControlPlaneClient } from "@harness/client";
import type { Project, CoreEvent, ApprovalRequestFrame } from "@harness/protocol";

function freshServer() {
  const db = openDb(":memory:");
  const projects = new ProjectsStore(db);
  const sessions = new SessionsStore(db);
  const settings = new SettingsStore(db);
  const cp = new ControlPlane({
    projects,
    sessions,
    settings,
    workdirRoot: "/tmp",
    worktree: { pathFor: () => "/tmp/wt", create: async () => {}, remove: async () => {} },
  });
  cp.harnesses.register("fake", () => new FakeHarness());
  const project: Project = { projectId: "p1", name: "demo", workdir: "/tmp/demo", harness: "fake", permMode: "default" };
  projects.insert(project);
  return { cp, server: startServeServer(cp, { settings, host: "127.0.0.1", port: 0, localToken: "secret" }) };
}

test("client connects, starts a session, and sees live events", async () => {
  const { server } = freshServer();
  const client = createControlPlaneClient({ baseUrl: server.url, getToken: async () => "secret", autoReconnect: false });

  const events: CoreEvent[] = [];
  client.onEvent((e) => events.push(e));

  await client.connect();
  await Bun.sleep(20); // allow the hello handshake to assign connId
  expect(typeof client.connId).toBe("string");

  const session = await client.startSession({
    projectId: "p1",
    prompt: "do it",
    surface: { gateway: "ide", conversationId: client.connId! },
  });
  expect(session.projectId).toBe("p1");

  // startSession awaits the FakeHarness run (which emits text + result); give WS frames a tick to arrive.
  await Bun.sleep(20);
  expect(events.some((e) => e.kind === "text")).toBe(true);
  expect(events.some((e) => e.kind === "result")).toBe(true);

  client.close();
  server.stop();
});

test("approval round-trip: cp.requestApproval routes to the ide client and resolves", async () => {
  const { cp, server } = freshServer();
  const client = createControlPlaneClient({ baseUrl: server.url, getToken: async () => "secret", autoReconnect: false });

  const approvals: ApprovalRequestFrame[] = [];
  client.onApprovalRequest((r) => {
    approvals.push(r);
    client.resolveApproval(r.requestId, "allow");
  });

  await client.connect();
  await Bun.sleep(20);
  const connId = client.connId!;

  // Bind a session to THIS connection so approvals route here. (The FakeHarness run completes via allowAll.)
  const session = await client.startSession({ projectId: "p1", prompt: "go", surface: { gateway: "ide", conversationId: connId } });

  // Drive an approval directly through the control plane — the same entry point the PreToolUse hook uses.
  // permMode "default" + tool "Bash" => policy "ask" => routes to the bound "ide" gateway surface.
  // `requestApproval` only resolves once the full client round-trip completes, so no extra sleep is needed.
  const decision = await cp.requestApproval({ sessionPk: session.sessionPk, tool: "Bash", input: { command: "ls" } });
  expect(decision).toBe("allow");
  expect(approvals.length).toBe(1);
  expect(approvals[0]?.tool).toBe("Bash");

  client.close();
  server.stop();
});
