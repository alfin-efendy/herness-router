import { test, expect } from "bun:test";
import { $ } from "bun";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function runInstall(version: string) {
  if (process.platform === "win32") {
    const script = [
      `export RYUZI_VERSION=${shellQuote(version)}`,
      "export RYUZI_INSTALL_DIR=/tmp/ryuzi-test-bin",
      "tr -d '\\r' < ./install.sh | bash",
    ].join("; ");
    return await $`bash -c ${script}`.nothrow().quiet();
  }

  return await $`sh ./install.sh`
    .env({ ...process.env, RYUZI_VERSION: version, RYUZI_INSTALL_DIR: "/tmp/ryuzi-test-bin" })
    .nothrow()
    .quiet();
}

// Running the installer with a malformed explicit version must fail fast,
// before any download, and must not execute injected commands.
test("install.sh rejects a malformed RYUZI_VERSION before downloading", async () => {
  const marker = `pwned-${process.pid}`;
  const res = await runInstall(`v9.9.9; touch ${marker}`);
  expect(res.exitCode).not.toBe(0);
  expect(res.stderr.toString()).toContain("invalid version");
  // the injected command must not have run
  expect(await Bun.file(marker).exists()).toBe(false);
});

test("install.sh rejects a path-traversal RYUZI_VERSION (offline)", async () => {
  // Slashes are disallowed, so traversal never reaches a URL. Rejected before
  // any network call.
  const res = await runInstall("../../../tmp/evil");
  expect(res.exitCode).not.toBe(0);
  expect(res.stderr.toString()).toContain("invalid version");
});

test("install.sh does NOT over-reject a well-formed version format", async () => {
  // A valid-format tag (incl. an -rc suffix) must pass validation. It then
  // fails later at the network/download step (404), which is fine — we only
  // assert it got PAST validation (guards against an over-strict regex).
  const res = await runInstall("v0.0.0-rc.1");
  expect(res.stderr.toString()).not.toContain("invalid version");
});
