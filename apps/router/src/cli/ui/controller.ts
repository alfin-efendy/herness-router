import { EventEmitter } from "node:events";
import type { Database } from "bun:sqlite";
import { openDb } from "../../store/db";
import { SettingsStore } from "../../config/store";
import { SETTING_DEFS, GLOBAL_FIELDS, allFields } from "../../config/schema";
import type { detectClaude, detectGit } from "../../harness/detect";
import type { ToolInfo } from "../../harness/detect";
import { buildDaemon } from "../start-command";
import { reduceSessions, type LiveSession } from "./sessions-reducer";
import { SessionsStore } from "../../store/sessions";
import type { ControlPlane } from "../../core/control-plane";
import type { CoreEvent, Unsubscribe } from "@harness/protocol";
import type { Telemetry, Span, Attrs } from "../../observability/types";
import { catalog as defaultCatalog } from "../../providers/catalog";
import type { ProviderCatalog, GatewayDescriptor, RuntimeDescriptor, ConfigField } from "../../providers/types";
import { missingRequiredSettings, isConfigured as isConfiguredFn, requiredMissingFields, csv } from "../../config/required";

const GLOBAL_KEYS = new Set(GLOBAL_FIELDS.map((f) => f.key));

export interface ControllerDeps {
  dbPath: string;
  detect: { claude: typeof detectClaude; git: typeof detectGit };
  db?: Database;
  catalog?: ProviderCatalog;
}

export interface DaemonState { running: boolean; startedAt?: number; lastError?: string; starting?: boolean }
export interface SessionRow { sessionPk: string; projectId: string; status: string; title?: string; startedBy?: string; lastText?: string }

class SinkTelemetry implements Telemetry {
  constructor(private sink: (line: string) => void) {}
  startSpan(_n: string, _a?: Attrs): Span { return { setAttribute() {}, setError: (m) => this.sink("error: " + m), end() {} }; }
  count(name: string, _a?: Attrs): void { this.sink(name); }
  record(_n: string, _v: number, _a?: Attrs): void {}
}

export class AppController extends EventEmitter {
  readonly db: Database;
  readonly settings: SettingsStore;
  protected catalog: ProviderCatalog;
  private fieldIndex: Map<string, ConfigField>;
  private daemonHandle?: { stop(): void };
  private daemonCp?: ControlPlane;
  private daemonState: DaemonState = { running: false };
  private logLines: string[] = [];
  private live = new Map<string, LiveSession>();
  private cpUnsub?: Unsubscribe;

  constructor(protected deps: ControllerDeps) {
    super();
    this.db = deps.db ?? openDb(deps.dbPath);
    this.settings = new SettingsStore(this.db);
    this.catalog = deps.catalog ?? defaultCatalog;
    this.fieldIndex = new Map(allFields(this.catalog).map((f) => [f.key, f]));
  }

  protected emitChange(): void { this.emit("change"); }

  get(key: string): string | undefined { return this.settings.get(key); }
  set(key: string, value: string): void { this.settings.set(key, value); this.emitChange(); }
  settingKeys(): string[] { return Object.keys(SETTING_DEFS); }
  isSecret(key: string): boolean { return Boolean(SETTING_DEFS[key]?.secret); }
  missingRequired(): string[] { return missingRequiredSettings(this.settings, this.catalog); }
  isConfigured(): boolean { return isConfiguredFn(this.settings, this.catalog); }

  field(key: string): ConfigField | undefined { return this.fieldIndex.get(key); }
  generalFields(): ConfigField[] { return allFields(this.catalog).filter((f) => GLOBAL_KEYS.has(f.key) && !f.control); }
  gatewayDescriptors(): GatewayDescriptor[] { return this.catalog.gateways; }
  runtimeDescriptors(): RuntimeDescriptor[] { return this.catalog.runtimes; }
  gatewayFields(id: string): ConfigField[] { return this.catalog.gateway(id)?.fields ?? []; }
  runtimeFields(id: string): ConfigField[] { return this.catalog.runtime(id)?.fields ?? []; }
  enabledGateways(): string[] { return csv(this.get("enabled_gateways")); }
  enabledRuntimes(): string[] { return csv(this.get("enabled_runtimes")); }
  defaultRuntime(): string { return this.get("default_runtime") ?? ""; }
  setEnabledGateways(ids: string[]): void { this.set("enabled_gateways", ids.join(",")); }
  setEnabledRuntimes(ids: string[]): void { this.set("enabled_runtimes", ids.join(",")); }
  setDefaultRuntime(id: string): void { this.set("default_runtime", id); }
  requiredMissingFields(): ConfigField[] { return requiredMissingFields(this.settings, this.catalog); }
  detectRuntime(id: string): Promise<ToolInfo & { authenticated?: boolean }> {
    return this.catalog.runtime(id)?.detect() ?? Promise.resolve({ found: false });
  }

  async checkEnv(): Promise<{ git: ToolInfo; claude: ToolInfo & { authenticated?: boolean } }> {
    const [git, claude] = await Promise.all([this.deps.detect.git(), this.deps.detect.claude()]);
    return { git, claude };
  }

  daemon(): DaemonState { return this.daemonState; }
  logs(): string[] { return this.logLines; }

  private pushLog(line: string): void {
    this.logLines.push(line);
    if (this.logLines.length > 200) this.logLines.shift();
    this.emitChange();
  }

  sessions(): SessionRow[] {
    const store = new SessionsStore(this.db);
    return store.list().map((s) => {
      const live = this.live.get(s.sessionPk);
      return {
        sessionPk: s.sessionPk, projectId: s.projectId,
        status: live?.status ?? s.status, title: s.title,
        startedBy: s.startedBy, lastText: live?.lastText,
      };
    });
  }

  async startDaemon(): Promise<void> {
    if (this.daemonState.running || this.daemonState.starting) return;
    const missing = this.missingRequired();
    if (missing.length || this.enabledGateways().length === 0) {
      const why = missing.length ? `missing settings: ${missing.join(", ")}` : "no gateways enabled";
      this.daemonState = { running: false, lastError: why };
      this.emitChange();
      return;
    }
    const telemetry = new SinkTelemetry((line) => this.pushLog(line));
    const daemon = buildDaemon({ dbPath: this.deps.dbPath, db: this.db, telemetry, catalog: this.catalog });
    this.daemonCp = daemon.cp;
    this.cpUnsub = daemon.cp.subscribe((e: CoreEvent) => { reduceSessions(this.live, e); this.emitChange(); });
    this.daemonState = { ...this.daemonState, starting: true, lastError: undefined };
    this.emitChange();
    try {
      await daemon.start();
      this.daemonHandle = daemon;
      this.daemonState = { running: true, startedAt: Date.now(), starting: false };
      this.pushLog("daemon started");
    } catch (e) {
      this.cpUnsub?.(); this.cpUnsub = undefined; this.daemonCp = undefined;
      this.daemonState = { running: false, starting: false, lastError: (e as Error).message };
      this.emitChange();
    }
  }

  stopDaemon(): void {
    this.daemonHandle?.stop();
    this.cpUnsub?.(); this.cpUnsub = undefined; this.daemonCp = undefined; this.daemonHandle = undefined;
    this.daemonState = { ...this.daemonState, running: false, startedAt: undefined };
    this.pushLog("daemon stopped");
  }

  async toggleDaemon(): Promise<void> {
    if (this.daemonState.running) this.stopDaemon(); else await this.startDaemon();
  }
}
