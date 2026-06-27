import { test, expect } from "bun:test";
import { runCli, type CliDeps, type IO } from "../src/cli/run";
import { detectClaude, detectGit } from "../src/harness/detect";

test("init persists answers and required values", async () => {
  const dbPath = `/tmp/harness-init-${Bun.hash(Math.random().toString())}.sqlite`;
  const answers = [
    "tok", "app", "guild", "/repos", // required four
    "", "", "", "", "", "", "", "",   // keep defaults for the rest
  ];
  const lines: string[] = [];
  const io: IO = { out: (s) => lines.push(s), err: (s) => lines.push(s), prompt: async () => answers.shift() ?? "" };
  const deps: CliDeps = { io, dbPath, detect: { claude: detectClaude, git: detectGit } };

  expect(await runCli(["init"], deps)).toBe(0);

  const verify: string[] = [];
  const io2: IO = { out: (s) => verify.push(s), err: (s) => verify.push(s), prompt: async () => "" };
  await runCli(["config", "get", "workdir_root"], { io: io2, dbPath, detect: { claude: detectClaude, git: detectGit } });
  expect(verify.join("\n")).toContain("/repos");
});
