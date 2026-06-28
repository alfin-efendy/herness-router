import type React from "react";
import { useState } from "react";
import { FilesTab } from "./FilesTab";

type Tab = "files" | "git" | "terminal";

export function RightPanel() {
  const [tab, setTab] = useState<Tab>("files");
  const [width, setWidth] = useState(360);

  function onDrag(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const move = (ev: MouseEvent) => setWidth(Math.max(240, Math.min(800, startW + (startX - ev.clientX))));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <aside className="relative flex shrink-0 flex-col border-l" style={{ width }} data-testid="right-panel">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag handle is a resize separator, not a focus target */}
      <div className="absolute left-0 top-0 h-full w-1 cursor-col-resize" onMouseDown={onDrag} data-testid="right-panel-resize" />
      <div className="flex shrink-0 border-b text-xs">
        {(["files", "git", "terminal"] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={t !== "files"}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 capitalize ${tab === t ? "border-b-2 border-foreground font-medium" : "text-muted-foreground"} disabled:opacity-40`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{tab === "files" && <FilesTab />}</div>
    </aside>
  );
}
