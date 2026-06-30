import { mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";

export function worktreePathFor(workdirRoot: string, projectId: string, sessionPk: string): string {
  return join(workdirRoot, ".harness-worktrees", projectPathSegment(projectId), sessionPk);
}

function projectPathSegment(projectId: string): string {
  const leaf = projectId.split(/[\\/]+/).filter(Boolean).pop() ?? basename(projectId);
  const name = leaf.replace(/[^A-Za-z0-9._-]/g, "_") || "project";
  const hash = createHash("sha256").update(projectId).digest("hex").slice(0, 12);
  return `${name}-${hash}`;
}

// Resolve the freshest base ref to branch a new worktree off of: fetch origin and
// return `origin/<default-branch>`. Returns undefined when there is no origin
// remote or any git step fails, so callers fall back to local HEAD. Never throws.
export async function resolveFreshBase(repoDir: string): Promise<string | undefined> {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  const hasOrigin = await Bun.$`git -C ${repoDir} remote get-url origin`.env(env).quiet().nothrow();
  if (hasOrigin.exitCode !== 0) return undefined;
  const fetched = await Bun.$`git -C ${repoDir} fetch origin --quiet`.env(env).quiet().nothrow();
  if (fetched.exitCode !== 0) {
    console.warn(`[worktree] git fetch failed for ${repoDir}; branching off local HEAD`);
    return undefined;
  }
  let head = await readOriginHead(repoDir, env);
  if (!head) {
    await Bun.$`git -C ${repoDir} remote set-head origin --auto`.env(env).quiet().nothrow();
    head = await readOriginHead(repoDir, env);
  }
  return head || "origin/main";
}

async function readOriginHead(repoDir: string, env: Record<string, string | undefined>): Promise<string> {
  const out = await Bun.$`git -C ${repoDir} symbolic-ref --short refs/remotes/origin/HEAD`.env(env).quiet().nothrow();
  return out.exitCode === 0 ? out.stdout.toString().trim() : "";
}

export async function createWorktree(repoDir: string, worktreePath: string, branch: string, baseRef?: string): Promise<void> {
  // git worktree add does not create leading directories — ensure the parent exists.
  mkdirSync(dirname(worktreePath), { recursive: true });
  if (baseRef) {
    await Bun.$`git -C ${repoDir} worktree add -b ${branch} ${worktreePath} ${baseRef}`.quiet();
  } else {
    await Bun.$`git -C ${repoDir} worktree add -b ${branch} ${worktreePath}`.quiet();
  }
}

export async function removeWorktree(repoDir: string, worktreePath: string): Promise<void> {
  await Bun.$`git -C ${repoDir} worktree remove --force ${worktreePath}`.quiet();
}
