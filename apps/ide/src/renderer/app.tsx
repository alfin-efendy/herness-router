// apps/ide/src/renderer/app.tsx
import React from "react";

export function App() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-10 shrink-0 items-center border-b px-3 text-sm font-medium" data-testid="top-bar">
        Harness IDE
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-auto border-r" data-testid="sidebar" />
        <main className="min-w-0 flex-1 overflow-auto" data-testid="center" />
        <aside className="w-72 shrink-0 overflow-auto border-l" data-testid="right-rail" />
      </div>
    </div>
  );
}
