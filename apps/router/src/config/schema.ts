export interface SettingDef {
  required: boolean;
  secret?: boolean;
  default?: string;
  oneOf?: string[];
  int?: boolean;
}

export const SETTING_DEFS: Record<string, SettingDef> = {
  discord_token: { required: true, secret: true },
  discord_app_id: { required: true },
  discord_guild_id: { required: true },
  workdir_root: { required: true },
  admin_role_ids: { required: false, default: "" },
  approver_role_ids: { required: false, default: "" },
  default_model: { required: false, default: "" },
  default_effort: { required: false, default: "medium" },
  default_perm_mode: { required: false, default: "default", oneOf: ["default", "acceptEdits", "bypassPermissions"] },
  otel_endpoint: { required: false, default: "" },
  max_concurrent_runs: { required: false, default: "3", int: true },
  approval_timeout_ms: { required: false, default: "300000", int: true },
};

export function validateSetting(key: string, value: string): string | null {
  const def = SETTING_DEFS[key];
  if (!def) return `unknown setting: ${key}`;
  if (def.oneOf && !def.oneOf.includes(value)) return `${key} must be one of: ${def.oneOf.join(", ")}`;
  if (def.int && !/^\d+$/.test(value)) return `${key} must be an integer`;
  return null;
}
