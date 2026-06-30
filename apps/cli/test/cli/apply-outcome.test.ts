import { test, expect } from "bun:test";
import { handleApplyOutcome } from "../../src/cli/update-applier";

function spy() {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      spawnFreshDaemon: () => calls.push("spawn"),
      exit: (c: number) => calls.push("exit:" + c),
      log: () => {},
    },
  };
}
test("promoted → exit(0), no respawn", () => {
  const s = spy();
  handleApplyOutcome("promoted", s.deps);
  expect(s.calls).toEqual(["exit:0"]);
});
test("rolledback → respawn then exit(0)", () => {
  const s = spy();
  handleApplyOutcome("rolledback", s.deps);
  expect(s.calls).toEqual(["spawn", "exit:0"]);
});
test("aborted → neither (old daemon keeps serving)", () => {
  const s = spy();
  handleApplyOutcome("aborted", s.deps);
  expect(s.calls).toEqual([]);
});
