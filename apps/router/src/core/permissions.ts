import type { PermMode } from "@harness/protocol";

export type ToolDecision = "allow" | "ask";

export const SAFE_TOOLS = ["Read", "Grep", "Glob", "LS", "NotebookRead", "TodoWrite"] as const;
const EDIT_TOOLS = ["Edit", "Write", "MultiEdit", "NotebookEdit"];

export function resolveToolPolicy(permMode: PermMode, toolName: string): ToolDecision {
  if (permMode === "bypassPermissions") return "allow";
  if ((SAFE_TOOLS as readonly string[]).includes(toolName)) return "allow";
  if (permMode === "acceptEdits" && EDIT_TOOLS.includes(toolName)) return "allow";
  return "ask";
}

/**
 * Whether a clicker may approve a tool. Starter always may. If NO approver roles are
 * configured, ANY thread participant may approve (by design — roles are optional gating).
 * Otherwise the clicker must hold one of the approver roles.
 */
export function canApprove(o: { clickerRoleIds: string[]; approverRoleIds: string[]; isStarter: boolean }): boolean {
  if (o.isStarter) return true;
  if (o.approverRoleIds.length === 0) return true;
  return o.clickerRoleIds.some((r) => o.approverRoleIds.includes(r));
}

export function summarizeTool(toolName: string, input: unknown): string {
  const obj = (input ?? {}) as Record<string, unknown>;
  if (toolName === "Bash" && typeof obj.command === "string") return `Bash: ${obj.command.slice(0, 80)}`;
  const target = obj.file_path ?? obj.path ?? obj.pattern;
  return typeof target === "string" ? `${toolName}: ${target}` : toolName;
}
