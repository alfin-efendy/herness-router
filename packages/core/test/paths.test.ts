import { test, expect } from "bun:test";
import { expandHome } from "../src/config/paths";

test("expandHome expands leading ~ to HOME, leaves others", () => {
  const prevHome = process.env.HOME;
  process.env.HOME = "/tmp/ryuzi-home";
  try {
    expect(expandHome("~/sandbox-test")).toBe("/tmp/ryuzi-home/sandbox-test");
    expect(expandHome("~")).toBe("/tmp/ryuzi-home");
    expect(expandHome("/abs/path")).toBe("/abs/path");
    expect(expandHome("relative/dir")).toBe("relative/dir");
    expect(expandHome("~user/x")).toBe("~user/x"); // only `~` and `~/...` expand, not `~user`
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }
  }
});
