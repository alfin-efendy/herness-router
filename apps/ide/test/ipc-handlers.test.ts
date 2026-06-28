// apps/ide/test/ipc-handlers.test.ts
import { test, expect, mock } from "bun:test";

// Stub electron's ipcMain so registerIpc can register handlers we can invoke.
const handlers = new Map<string, (...args: any[]) => any>();
mock.module("electron", () => ({
  ipcMain: { handle: (ch: string, fn: (...a: any[]) => any) => handlers.set(ch, (...a: any[]) => fn({}, ...a)) },
}));

const { registerIpc } = await import("../src/main/ipc");

test("registered handlers delegate to the active client", async () => {
  const fakeClient: any = {
    connId: "c1",
    listProjects: mock(async () => [{ projectId: "p1", name: "n", workdir: "/w", harness: "fake", permMode: "default" }]),
    startSession: mock(async (req: any) => ({ sessionPk: "s1", projectId: req.projectId, status: "running" })),
    stopSession: mock(async () => undefined),
  };
  registerIpc(() => fakeClient);
  const projects = await handlers.get("listProjects")!();
  expect(projects[0].projectId).toBe("p1");
  const connId = await handlers.get("getConnId")!();
  expect(connId).toBe("c1");
  const session = await handlers.get("startSession")!({ projectId: "p1", prompt: "hi" });
  expect(session.sessionPk).toBe("s1");
});

test("handlers throw a clear error when no client is connected", async () => {
  handlers.clear();
  registerIpc(() => null);
  await expect(handlers.get("listProjects")!()).rejects.toThrow(/not connected/i);
});
