// apps/ide/src/renderer/app.tsx
import React, { useEffect } from "react";
import { hydrate } from "./ipc-bridge";
import { TopBar } from "./screens/TopBar";
import { ProjectsSessionsTree } from "./screens/ProjectsSessionsTree";
import { SessionTranscript } from "./screens/SessionTranscript";

export function App() {
  useEffect(() => hydrate(), []);
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-auto border-r">
          <ProjectsSessionsTree />
        </aside>
        <main className="min-w-0 flex-1 overflow-auto">
          <SessionTranscript />
        </main>
        <aside className="w-72 shrink-0 overflow-auto border-l" data-testid="right-rail" />
      </div>
    </div>
  );
}
