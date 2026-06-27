import { EventEmitter } from "node:events";
import type { Database } from "bun:sqlite";
import { openDb } from "../../store/db";
import { SettingsStore } from "../../config/store";
import { SETTING_DEFS } from "../../config/schema";
import type { detectClaude, detectGit } from "../../harness/detect";
import type { ToolInfo } from "../../harness/detect";
import type { DiscordPort } from "../../gateways/discord/index";
import type { Harness } from "../../harness/types";

export interface ControllerDeps {
  dbPath: string;
  detect: { claude: typeof detectClaude; git: typeof detectGit };
  db?: Database;
  portFactory?: (cfg: { token: string; appId: string; guildId: string }) => DiscordPort;
  harnessFactory?: () => Harness;
}

export class AppController extends EventEmitter {
  readonly db: Database;
  readonly settings: SettingsStore;

  constructor(protected deps: ControllerDeps) {
    super();
    this.db = deps.db ?? openDb(deps.dbPath);
    this.settings = new SettingsStore(this.db);
  }

  protected emitChange(): void { this.emit("change"); }

  get(key: string): string | undefined { return this.settings.get(key); }
  set(key: string, value: string): void { this.settings.set(key, value); this.emitChange(); }
  settingKeys(): string[] { return Object.keys(SETTING_DEFS); }
  isSecret(key: string): boolean { return Boolean(SETTING_DEFS[key]?.secret); }
  requiredKeys(): string[] { return Object.entries(SETTING_DEFS).filter(([, d]) => d.required).map(([k]) => k); }
  missingRequired(): string[] { return this.settings.missingRequired(); }
  isConfigured(): boolean { return this.missingRequired().length === 0; }

  async checkEnv(): Promise<{ git: ToolInfo; claude: ToolInfo & { authenticated?: boolean } }> {
    const [git, claude] = await Promise.all([this.deps.detect.git(), this.deps.detect.claude()]);
    return { git, claude };
  }
}
