// apps/ide/test/ipc-handlers-2b.test.ts
import { test, expect, mock } from "bun:test";

const handlers = new Map<string, (...args: any[]) => any>();
mock.module("electron", () => ({
  ipcMain: { handle: (ch: string, fn: (...a: any[]) => any) => handlers.set(ch, (...a: any[]) => fn({}, ...a)) },
}));

const { registerIpc } = await import("../src/main/ipc");

test("connectProject handler fills gateway+workspaceId and delegates", async () => {
  let received: any;
  const fakeClient: any = {
    connectProject: mock(async (req: any) => {
      received = req;
      return { projectId: "p9", name: req.name ?? "from-url", workdir: "/w", harness: "fake", permMode: "default" };
    }),
  };
  registerIpc(() => fakeClient);
  const project = await handlers.get("connectProject")!({ gitUrl: "https://x/y.git" });
  expect(project.projectId).toBe("p9");
  expect(received.gateway).toBe("ide");
  expect(typeof received.workspaceId).toBe("string");
  expect(received.gitUrl).toBe("https://x/y.git");
});

test("resolveApproval handler delegates to the client", async () => {
  const calls: any[] = [];
  const fakeClient: any = { resolveApproval: (id: string, d: string) => calls.push([id, d]) };
  handlers.clear();
  registerIpc(() => fakeClient);
  await handlers.get("resolveApproval")!("r1", "allow");
  expect(calls[0]).toEqual(["r1", "allow"]);
});
