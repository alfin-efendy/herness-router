#!/usr/bin/env bun
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { detectClaude, detectGit } from "@ryuzi/core";
import { runCli, type IO } from "./run";

export function migrateLegacyDbFiles(nextDir: string, legacyDir: string): void {
  const nextDb = `${nextDir}/ryuzi.sqlite`;
  const legacyDbName = "har" + "ness.sqlite";
  const legacyDb = `${legacyDir}/${legacyDbName}`;
  mkdirSync(nextDir, { recursive: true });
  if (existsSync(nextDb) || !existsSync(legacyDb)) return;

  copyFileSync(legacyDb, nextDb);
  for (const [nextName, legacyName] of [
    ["ryuzi.sqlite-wal", `${legacyDbName}-wal`],
    ["ryuzi.sqlite-shm", `${legacyDbName}-shm`],
  ] as const) {
    const nextPath = `${nextDir}/${nextName}`;
    const legacyPath = `${legacyDir}/${legacyName}`;
    if (existsSync(legacyPath)) {
      copyFileSync(legacyPath, nextPath);
    }
  }
}

export function defaultDbPath(env: Pick<NodeJS.ProcessEnv, "HOME"> = process.env as Pick<NodeJS.ProcessEnv, "HOME">): string {
  const base = `${env.HOME ?? "."}/.local/share`;
  const nextDir = `${base}/ryuzi`;
  const legacyDir = `${base}/${"har" + "ness"}-router`;
  migrateLegacyDbFiles(nextDir, legacyDir);
  return `${nextDir}/ryuzi.sqlite`;
}

async function promptStdin(q: string): Promise<string> {
  process.stdout.write(q);
  for await (const line of console) return line;
  return "";
}

async function main(): Promise<number> {
  const io: IO = {
    out: (s) => console.log(s),
    err: (s) => console.error(s),
    prompt: promptStdin,
  };

  const dbPath = defaultDbPath();
  await Bun.$`mkdir -p ${dbPath.slice(0, dbPath.lastIndexOf("/"))}`.quiet();

  return runCli(process.argv.slice(2), {
    io,
    dbPath,
    detect: { claude: detectClaude, git: detectGit },
  });
}

if (import.meta.main) {
  process.on("unhandledRejection", (reason) => {
    console.error("unhandledRejection:", reason);
  });

  const code = await main();
  process.exit(code);
}
