import { test, expect } from "bun:test";
import { sha256Hex, type Platform } from "@harness/core";
import { stageCanary, type StageDeps } from "../../src/cli/update-stage";

const platform: Platform = { goos: "linux", goarch: "amd64", musl: false };
const RYUZI = new TextEncoder().encode("#!/fake/ryuzi binary\n");

function fetchFor(assetBytes: Uint8Array, checksums: string, opts: { assetStatus?: number; checksumsStatus?: number } = {}): typeof fetch {
  return (async (url: string) => {
    if (String(url).endsWith("checksums.txt")) return new Response(checksums, { status: opts.checksumsStatus ?? 200 });
    return new Response(assetBytes, { status: opts.assetStatus ?? 200 });
  }) as unknown as typeof fetch;
}

function deps(over: Partial<StageDeps> = {}): { deps: StageDeps; writes: Array<{ path: string; mode: number }> } {
  const writes: Array<{ path: string; mode: number }> = [];
  const checksums = `${sha256Hex(new TextEncoder().encode("tarball"))}  ryuzi_0.3.0_linux_amd64.tar.gz\n`;
  return {
    writes,
    deps: {
      fetchImpl: fetchFor(new TextEncoder().encode("tarball"), checksums),
      extractHr: async () => RYUZI,
      writeFile: (path, _bytes, mode) => writes.push({ path, mode }),
      platform,
      tmpDir: "/tmp/ryuzi-stage",
      ...over,
    },
  };
}

test("stage downloads, verifies, extracts and writes .ryuzi.canary 0755", async () => {
  const { deps: d, writes } = deps();
  const res = await stageCanary({ repo: "o/r", tag: "v0.3.0", version: "0.3.0", installPath: "/home/me/.local/bin/ryuzi" }, d);
  expect(res.ok).toBe(true);
  expect(res.canaryPath).toBe("/home/me/.local/bin/.ryuzi.canary");
  expect(writes).toEqual([
    { path: "/tmp/ryuzi-stage/ryuzi_0.3.0_linux_amd64.tar.gz", mode: 0o600 },
    { path: "/home/me/.local/bin/.ryuzi.canary", mode: 0o755 },
  ]);
});

test("stage fails (no write) when the checksum does not match", async () => {
  const badChecksums = `deadbeef  ryuzi_0.3.0_linux_amd64.tar.gz\n`;
  const { deps: d, writes } = deps({ fetchImpl: fetchFor(new TextEncoder().encode("tarball"), badChecksums) });
  const res = await stageCanary({ repo: "o/r", tag: "v0.3.0", version: "0.3.0", installPath: "/home/me/.local/bin/ryuzi" }, d);
  expect(res.ok).toBe(false);
  expect(res.error).toMatch(/checksum/i);
  expect(writes).toHaveLength(0);
});

test("stage fails (no write) when the asset download is not ok", async () => {
  const checksums = `${sha256Hex(new TextEncoder().encode("tarball"))}  ryuzi_0.3.0_linux_amd64.tar.gz\n`;
  const { deps: d, writes } = deps({ fetchImpl: fetchFor(new TextEncoder().encode("tarball"), checksums, { assetStatus: 404 }) });
  const res = await stageCanary({ repo: "o/r", tag: "v0.3.0", version: "0.3.0", installPath: "/home/me/.local/bin/ryuzi" }, d);
  expect(res.ok).toBe(false);
  expect(writes).toHaveLength(0);
});

test("stage fails (no write) when the checksums download is not ok", async () => {
  const checksums = `${sha256Hex(new TextEncoder().encode("tarball"))}  ryuzi_0.3.0_linux_amd64.tar.gz\n`;
  const { deps: d, writes } = deps({ fetchImpl: fetchFor(new TextEncoder().encode("tarball"), checksums, { checksumsStatus: 403 }) });
  const res = await stageCanary({ repo: "o/r", tag: "v0.3.0", version: "0.3.0", installPath: "/home/me/.local/bin/ryuzi" }, d);
  expect(res.ok).toBe(false);
  expect(writes).toHaveLength(0);
});
