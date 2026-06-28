// apps/router/test/serve/remote-gateway.test.ts
import { test, expect } from "bun:test";
import { ConnectionHub } from "../../src/serve/connections";
import { RemoteGateway } from "../../src/serve/remote-gateway";
import type { ServerFrame } from "@harness/protocol";

test("approval resolves when the client answers", async () => {
  const hub = new ConnectionHub();
  const frames: ServerFrame[] = [];
  hub.add("c1", (f) => frames.push(f));
  const gw = new RemoteGateway(hub);
  const p = gw.requestApproval(
    { gateway: "ide", conversationId: "c1" },
    { requestId: "r1", tool: "Bash", summary: "Bash: ls", timeoutMs: 1000 },
  );
  // The client received an approval.request frame:
  const sent = frames.find((f) => f.t === "approval.request");
  expect(sent && sent.t === "approval.request" && sent.requestId).toBe("r1");
  hub.resolveApproval("r1", "allow");
  expect(await p).toEqual({ decision: "allow", actor: "ide" });
});

test("approval denies on timeout", async () => {
  const hub = new ConnectionHub();
  hub.add("c1", () => {});
  const gw = new RemoteGateway(hub);
  const decision = await gw.requestApproval(
    { gateway: "ide", conversationId: "c1" },
    { requestId: "r2", tool: "Bash", summary: "x", timeoutMs: 10 },
  );
  expect(decision).toEqual({ decision: "deny", actor: "timeout" });
});

test("approval denies immediately if the connection is gone", async () => {
  const hub = new ConnectionHub();
  const gw = new RemoteGateway(hub);
  const decision = await gw.requestApproval(
    { gateway: "ide", conversationId: "missing" },
    { requestId: "r3", tool: "Bash", summary: "x", timeoutMs: 1000 },
  );
  expect(decision).toEqual({ decision: "deny", actor: "offline" });
});
