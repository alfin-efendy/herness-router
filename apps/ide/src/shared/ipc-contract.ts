import type { Project, Session, CoreEvent, StartSessionRequest, ContinueSessionRequest } from "@harness/protocol";

export const IPC_COMMANDS = [
  "listProjects",
  "getProject",
  "listSessions",
  "startSession",
  "continueSession",
  "stopSession",
  "endSession",
  "getConnId",
] as const;
export type IpcCommand = (typeof IPC_COMMANDS)[number];

export const EVENT_CHANNEL = "harness:event";
export const CONNECTION_CHANNEL = "harness:connection";
export type ConnState = "connecting" | "open" | "closed";

export interface HarnessBridge {
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  listSessions(projectId?: string): Promise<Session[]>;
  startSession(req: StartSessionRequest): Promise<Session>;
  continueSession(req: ContinueSessionRequest): Promise<void>;
  stopSession(sessionPk: string): Promise<void>;
  endSession(sessionPk: string, opts?: { keepBranch?: boolean }): Promise<void>;
  getConnId(): Promise<string | null>;
  onEvent(cb: (e: CoreEvent) => void): () => void;
  onConnectionChange(cb: (s: ConnState) => void): () => void;
}

declare global {
  interface Window {
    harness: HarnessBridge;
  }
}
