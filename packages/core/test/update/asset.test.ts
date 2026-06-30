import { test, expect } from "bun:test";
import { assetName, assetUrl, checksumsUrl, sha256Hex, verifyChecksum, detectPlatform } from "../../src/update/asset";

test("assetName matches the goreleaser/install.sh layout", () => {
  expect(assetName("0.3.0", { goos: "linux", goarch: "amd64", musl: false })).toBe("harness-router_0.3.0_linux_amd64.tar.gz");
  expect(assetName("0.3.0", { goos: "linux", goarch: "arm64", musl: true })).toBe("harness-router_0.3.0_linux_arm64_musl.tar.gz");
  expect(assetName("1.2.0", { goos: "darwin", goarch: "arm64", musl: false })).toBe("harness-router_1.2.0_darwin_arm64.tar.gz");
});

test("URLs point at the GitHub release download path", () => {
  expect(assetUrl("o/r", "v0.3.0", "a.tar.gz")).toBe("https://github.com/o/r/releases/download/v0.3.0/a.tar.gz");
  expect(checksumsUrl("o/r", "v0.3.0")).toBe("https://github.com/o/r/releases/download/v0.3.0/checksums.txt");
});

test("sha256Hex + verifyChecksum accept a matching entry and reject a mismatch", () => {
  const bytes = new TextEncoder().encode("hello");
  const hex = sha256Hex(bytes);
  expect(hex).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  const checksums = `${hex}  harness-router_0.3.0_linux_amd64.tar.gz\ndead  other.tar.gz\n`;
  expect(verifyChecksum(bytes, "harness-router_0.3.0_linux_amd64.tar.gz", checksums)).toBe(true);
  expect(verifyChecksum(bytes, "other.tar.gz", checksums)).toBe(false); // wrong hash for this name
  expect(verifyChecksum(bytes, "missing.tar.gz", checksums)).toBe(false); // not listed
});

test("detectPlatform maps node platform/arch and rejects unsupported", () => {
  expect(detectPlatform({ platform: "linux", arch: "x64", musl: false })).toEqual({ goos: "linux", goarch: "amd64", musl: false });
  expect(detectPlatform({ platform: "darwin", arch: "arm64", musl: false })).toEqual({ goos: "darwin", goarch: "arm64", musl: false });
  expect(detectPlatform({ platform: "win32", arch: "x64" })).toBeNull();
  expect(detectPlatform({ platform: "linux", arch: "riscv64" })).toBeNull();
});
