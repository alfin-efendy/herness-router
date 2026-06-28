// apps/ide/test/approvals-rail.test.tsx
import { test, expect, mock, beforeAll, afterAll, beforeEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
beforeAll(() => {
  if (!globalThis.document) {
    GlobalRegistrator.register();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  }
});
afterAll(() => GlobalRegistrator.unregister());

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useStore } from "../src/renderer/store";
import { ApprovalsRail } from "../src/renderer/screens/ApprovalsRail";

let container: HTMLElement;
let root: Root;
beforeEach(() => {
  useStore.setState({
    pendingApprovals: [{ t: "approval.request", requestId: "r1", sessionPk: "s1", tool: "Bash", summary: "Bash: ls", timeoutMs: 60000 }],
  });
  (window as any).harness = { resolveApproval: mock(() => {}) };
  container = document.createElement("div");
});

test("renders an approval card and Allow calls resolveApproval + removes it", async () => {
  root = createRoot(container);
  await act(async () => {
    root.render(<ApprovalsRail />);
  });
  expect(container.textContent).toContain("Bash: ls");
  const allow = [...container.querySelectorAll("button")].find((b) => /allow/i.test(b.textContent ?? ""))!;
  await act(async () => {
    (allow as any)[Object.keys(allow).find((k) => k.startsWith("__reactProps$"))!].onClick({});
  });
  expect((window as any).harness.resolveApproval).toHaveBeenCalledWith("r1", "allow");
  expect(useStore.getState().pendingApprovals.length).toBe(0);
  await act(async () => {
    root.unmount();
  });
});
