// apps/ide/src/main/window.ts
import { app, BrowserWindow } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Locate a built asset under dist/ without relying on `__dirname`. `bun build --target=node`
// inlines `__dirname` as a literal of the SOURCE file's dir, so it points into src/ at runtime.
// `app.getAppPath()` is also launch-method-dependent: it is `.../dist/main` when started via
// `electron dist/main/index.js`, but the app root (containing dist/) when started via `electron .`
// or packaged. Try every layout and pick the one that exists on disk.
function distAsset(rel: string): string {
  const appPath = app.getAppPath();
  const fromDistMain = join(appPath, "..", rel); // appPath = .../dist/main -> .../dist/<rel> (electron dist/main/index.js)
  const candidates = [
    fromDistMain,
    join(appPath, "dist", rel), // appPath = app root -> .../dist/<rel> (electron . / packaged)
    join(appPath, rel), // appPath already = .../dist
  ];
  return candidates.find(existsSync) ?? fromDistMain;
}

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: distAsset("preload/index.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  win.loadFile(distAsset("renderer/index.html"));
  return win;
}
