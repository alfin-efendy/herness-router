import type { RuntimeDescriptor } from "../types";
import { ClaudeCodeHarness } from "../../harness/claude-code/index";
import { detectClaude } from "../../harness/detect";

export const claudeCodeRuntime: RuntimeDescriptor = {
  id: "claude-code",
  label: "Claude Code",
  description: "Anthropic's Claude Code CLI (uses your host login)",
  kind: "runtime",
  fields: [],
  detect: () => detectClaude(),
  build: () => new ClaudeCodeHarness(),
};
