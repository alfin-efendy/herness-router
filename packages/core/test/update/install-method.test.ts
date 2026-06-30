import { test, expect } from "bun:test";
import { detectInstallMethod } from "../../src/update/install-method";

test("non-compiled (bun <script>) is dev, never self-applies", () => {
  expect(detectInstallMethod({ execPath: "/home/me/.bun/bin/bun", compiled: false })).toEqual({
    method: "dev",
    selfApplicable: false,
  });
});

test("docker env is docker, never self-applies", () => {
  expect(detectInstallMethod({ execPath: "/usr/local/bin/hr", compiled: true, dockerEnv: true })).toEqual({
    method: "docker",
    selfApplicable: false,
  });
});

test("install.sh path (~/.local/bin/hr) is the only self-applicable method", () => {
  expect(detectInstallMethod({ execPath: "/home/me/.local/bin/hr", compiled: true, home: "/home/me" })).toEqual({
    method: "installsh",
    selfApplicable: true,
  });
});

test("homebrew / scoop / npm compiled installs are notify-only", () => {
  expect(detectInstallMethod({ execPath: "/opt/homebrew/bin/hr", compiled: true }).method).toBe("brew");
  expect(detectInstallMethod({ execPath: "/usr/local/Cellar/harness-router/0.2.0/bin/hr", compiled: true }).method).toBe("brew");
  expect(detectInstallMethod({ execPath: "C:\\Users\\me\\scoop\\apps\\harness-router\\current\\hr.exe", compiled: true }).method).toBe(
    "scoop",
  );
  expect(detectInstallMethod({ execPath: "/home/me/.npm-global/lib/node_modules/hrctl/bin/hr", compiled: true }).method).toBe("npm");
  for (const p of ["/opt/homebrew/bin/hr", "/usr/local/Cellar/x/bin/hr", "C:\\scoop\\hr.exe", "/x/node_modules/hrctl/hr"]) {
    expect(detectInstallMethod({ execPath: p, compiled: true }).selfApplicable).toBe(false);
  }
});

test("unknown compiled path defaults to notify-only", () => {
  expect(detectInstallMethod({ execPath: "/weird/place/hr", compiled: true })).toEqual({
    method: "unknown",
    selfApplicable: false,
  });
});

test("a sibling binary in ~/.local/bin (e.g. hrctl) is NOT install.sh", () => {
  const r = detectInstallMethod({ execPath: "/home/me/.local/bin/hrctl", compiled: true, home: "/home/me" });
  expect(r.method).toBe("unknown");
  expect(r.selfApplicable).toBe(false);
});
