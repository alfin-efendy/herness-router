// apps/ide/src/main/index.ts
import { app, BrowserWindow } from "electron";
import { createWindow } from "./window";
import { discoverLocalRouter } from "./discover";
import { createSession, type ClientHandle } from "./client";
import { registerIpc } from "./ipc";

let handle: ClientHandle | null = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.whenReady().then(async () => {
    const win = createWindow();
    registerIpc(() => handle?.client ?? null);
    const info = discoverLocalRouter();
    if (info) {
      handle = createSession({ info, send: (channel, payload) => win.webContents.send(channel, payload) });
      await handle.connect().catch((e) => console.error("connect failed:", e));
    } else {
      console.error("no local router found (serve.json absent) — start `hr serve`");
    }
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on("window-all-closed", () => {
    handle?.dispose();
    if (process.platform !== "darwin") app.quit();
  });
}
