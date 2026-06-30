export type InstallMethod = "installsh" | "npm" | "brew" | "scoop" | "docker" | "dev" | "unknown";

export interface InstallInfo {
  method: InstallMethod;
  selfApplicable: boolean;
}

/**
 * Classify how `hr` was installed from the running executable path. Only the
 * install.sh path (`~/.local/bin/hr`) is self-applicable — every other method is
 * managed by a package manager (or is dev/docker) and must be notify-only so the
 * daemon never clobbers a package manager's binary.
 */
export function detectInstallMethod(opts: { execPath: string; compiled: boolean; home?: string; dockerEnv?: boolean }): InstallInfo {
  if (!opts.compiled) return { method: "dev", selfApplicable: false };
  if (opts.dockerEnv) return { method: "docker", selfApplicable: false };

  const p = opts.execPath;
  const lower = p.toLowerCase();

  if (p.endsWith("/.local/bin/hr")) {
    return { method: "installsh", selfApplicable: true };
  }
  if (lower.includes("/cellar/") || lower.startsWith("/opt/homebrew/") || lower.includes("/homebrew/")) {
    return { method: "brew", selfApplicable: false };
  }
  if (lower.includes("\\scoop\\") || lower.includes("/scoop/")) {
    return { method: "scoop", selfApplicable: false };
  }
  if (lower.includes("/node_modules/") || lower.includes("\\node_modules\\")) {
    return { method: "npm", selfApplicable: false };
  }
  return { method: "unknown", selfApplicable: false };
}
