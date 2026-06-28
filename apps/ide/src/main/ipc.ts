// apps/ide/src/main/ipc.ts
import { ipcMain } from "electron";
import type { RemoteControlPlane } from "@harness/client";

export function registerIpc(getClient: () => RemoteControlPlane | null): void {
  const need = (): RemoteControlPlane => {
    const c = getClient();
    if (!c) throw new Error("router not connected");
    return c;
  };
  ipcMain.handle("listProjects", async () => need().listProjects());
  ipcMain.handle("getProject", async (_e, id: string) => need().getProject(id));
  ipcMain.handle("listSessions", async (_e, projectId?: string) => need().listSessions(projectId));
  ipcMain.handle("startSession", async (_e, req) => need().startSession(req));
  ipcMain.handle("continueSession", async (_e, req) => need().continueSession(req));
  ipcMain.handle("stopSession", async (_e, sessionPk: string) => need().stopSession(sessionPk));
  ipcMain.handle("endSession", async (_e, sessionPk: string, opts?: { keepBranch?: boolean }) => need().endSession(sessionPk, opts));
  ipcMain.handle("getConnId", async () => getClient()?.connId ?? null);
}
