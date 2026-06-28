// apps/ide/test/store.test.ts
import { test, expect } from "bun:test";
import { useStore } from "../src/renderer/store";

test("applyEvent appends text/result to the session transcript", () => {
  const s = useStore.getState();
  s.applyEvent({ kind: "text", sessionPk: "s1", text: "hello" });
  s.applyEvent({ kind: "result", sessionPk: "s1", usage: undefined });
  const t = useStore.getState().transcripts.s1!;
  expect(t.map((e) => e.kind)).toEqual(["text", "result"]);
});

test("session.ended marks the matching session row ended", () => {
  useStore.getState().setSessions([{ sessionPk: "s2", projectId: "p1", status: "running" }]);
  useStore.getState().applyEvent({ kind: "session.ended", sessionPk: "s2" });
  expect(useStore.getState().sessions.find((x) => x.sessionPk === "s2")?.status).toBe("ended");
});
