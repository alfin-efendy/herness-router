import { existsSync } from "node:fs";

export interface Platform {
  goos: "linux" | "darwin";
  goarch: "amd64" | "arm64";
  musl: boolean;
}

export function assetName(version: string, p: Platform): string {
  return `ryuzi_${version}_${p.goos}_${p.goarch}${p.musl ? "_musl" : ""}.tar.gz`;
}

export function assetUrl(repo: string, tag: string, name: string): string {
  return `https://github.com/${repo}/releases/download/${tag}/${name}`;
}

export function checksumsUrl(repo: string, tag: string): string {
  return `https://github.com/${repo}/releases/download/${tag}/checksums.txt`;
}

export function sha256Hex(bytes: Uint8Array): string {
  const h = new Bun.CryptoHasher("sha256");
  h.update(bytes);
  return h.digest("hex");
}

/** checksums.txt lines are "<sha256>  <filename>"; verify the entry for `name`. */
export function verifyChecksum(bytes: Uint8Array, name: string, checksumsText: string): boolean {
  const want = sha256Hex(bytes);
  for (const line of checksumsText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sp = trimmed.indexOf(" ");
    if (sp < 0) continue;
    const hash = trimmed.slice(0, sp);
    const file = trimmed.slice(sp).trim();
    if (file === name) return hash.toLowerCase() === want.toLowerCase();
  }
  return false;
}

export function detectPlatform(env?: { platform?: string; arch?: string; musl?: boolean }): Platform | null {
  const platform = env?.platform ?? process.platform;
  const arch = env?.arch ?? process.arch;
  const goos = platform === "linux" ? "linux" : platform === "darwin" ? "darwin" : null;
  const goarch = arch === "x64" ? "amd64" : arch === "arm64" ? "arm64" : null;
  if (!goos || !goarch) return null;
  const musl = env?.musl ?? (goos === "linux" && existsSync("/etc/alpine-release"));
  return { goos, goarch, musl };
}
