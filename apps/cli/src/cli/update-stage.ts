import { dirname, join } from "node:path/posix";
import { assetName, assetUrl, checksumsUrl, verifyChecksum, type Platform } from "@ryuzi/core";

export interface StageDeps {
  fetchImpl?: typeof fetch;
  extractRyuzi: (tarPath: string, destDir: string) => Promise<Uint8Array>;
  writeFile: (path: string, bytes: Uint8Array, mode: number) => void;
  platform: Platform;
  tmpDir: string;
}

export interface StageResult {
  ok: boolean;
  canaryPath?: string;
  error?: string;
}

export async function stageCanary(
  opts: { repo: string; tag: string; version: string; installPath: string },
  deps: StageDeps,
): Promise<StageResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const name = assetName(opts.version, deps.platform);
  try {
    const assetRes = await fetchImpl(assetUrl(opts.repo, opts.tag, name));
    if (!assetRes.ok) return { ok: false, error: `asset download failed: HTTP ${assetRes.status}` };
    const assetBytes = new Uint8Array(await assetRes.arrayBuffer());

    const sumRes = await fetchImpl(checksumsUrl(opts.repo, opts.tag));
    if (!sumRes.ok) return { ok: false, error: `checksums download failed: HTTP ${sumRes.status}` };
    const checksums = await sumRes.text();

    if (!verifyChecksum(assetBytes, name, checksums)) return { ok: false, error: `checksum verification failed for ${name}` };

    const tarPath = join(deps.tmpDir, name);
    deps.writeFile(tarPath, assetBytes, 0o600);
    const ryuziBytes = await deps.extractRyuzi(tarPath, deps.tmpDir);

    const canaryPath = join(dirname(opts.installPath), ".ryuzi.canary");
    deps.writeFile(canaryPath, ryuziBytes, 0o755);
    return { ok: true, canaryPath };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function defaultExtractRyuzi(tarPath: string, destDir: string): Promise<Uint8Array> {
  const proc = Bun.spawn(["tar", "-xzf", tarPath, "-C", destDir], { stdout: "ignore", stderr: "pipe" });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`tar failed: ${(await new Response(proc.stderr).text()).slice(0, 200)}`);
  const ryuzi = Bun.file(join(destDir, "ryuzi"));
  return new Uint8Array(await ryuzi.arrayBuffer());
}
