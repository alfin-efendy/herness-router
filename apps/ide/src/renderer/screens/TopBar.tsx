// apps/ide/src/renderer/screens/TopBar.tsx
import React from "react";
import { useStore } from "../store";

export function TopBar() {
  const connection = useStore((s) => s.connection);
  const dot = connection === "open" ? "bg-green-500" : connection === "connecting" ? "bg-yellow-500" : "bg-gray-500";
  return (
    <header className="flex h-10 items-center gap-2 border-b px-3 text-sm" data-testid="top-bar">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      <span>router: localhost</span>
      <span className="ml-2 text-muted-foreground">{connection}</span>
    </header>
  );
}
