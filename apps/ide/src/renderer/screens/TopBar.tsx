import React from "react";
import { useStore } from "../store";
import { ConnectionsDialog } from "./ConnectionsDialog";

export function TopBar() {
  const connection = useStore((s) => s.connection);
  const active = useStore((s) => s.connections.find((c) => c.active));
  const dot = connection === "open" ? "bg-green-500" : connection === "connecting" ? "bg-yellow-500" : "bg-gray-500";
  return (
    <header className="flex h-10 items-center gap-2 border-b px-3 text-sm" data-testid="top-bar">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      <span>{active?.label ?? "no connection"}</span>
      <span className="text-muted-foreground">{connection}</span>
      <span className="ml-auto">
        <ConnectionsDialog />
      </span>
    </header>
  );
}
