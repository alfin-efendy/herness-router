import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import { Composer } from "./Composer";
import { ApprovalPrompt } from "./ApprovalPrompt";

export function SessionTranscript() {
  const { focusedSessionPk, transcripts, sessions, send, start, selectedProjectId, projects } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lines = focusedSessionPk ? (transcripts[focusedSessionPk] ?? []) : [];

  // Keep the latest streamed line in view. Hooks MUST run before any early return (Rules of Hooks).
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are intentional re-run triggers (scroll on new line / session switch).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, focusedSessionPk]);

  if (!focusedSessionPk) {
    // A project is selected but no session focused → let the user start a new session on it.
    if (selectedProjectId) {
      const project = projects.find((p) => p.projectId === selectedProjectId);
      return (
        <div className="flex h-full flex-col">
          <div className="border-b border-border px-4 py-2 text-sm font-medium">
            New session on <span className="font-semibold">{project?.name ?? selectedProjectId}</span>
          </div>
          <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            Type a first message below to start a session.
          </div>
          <Composer onSubmit={(t) => start(selectedProjectId, t)} />
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a project (left) to start a session.
      </div>
    );
  }
  const session = sessions.find((s) => s.sessionPk === focusedSessionPk);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <span className="text-sm font-medium">{session?.title ?? focusedSessionPk.slice(0, 8)}</span>
        <span className="text-xs text-muted-foreground">{session?.status}</span>
        <span className="flex-1" />
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => useStore.getState().stop(focusedSessionPk)}
        >
          Stop
        </button>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-red-600"
          onClick={() => useStore.getState().end(focusedSessionPk)}
        >
          End
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto p-4">
        {lines.length === 0 && <div className="text-sm text-muted-foreground">Waiting for output…</div>}
        {lines.map((l, i) => (
          <div
            key={i}
            className={
              l.kind === "status"
                ? "text-xs font-mono text-muted-foreground"
                : l.kind === "error"
                  ? "rounded bg-destructive/10 p-2 text-sm text-destructive"
                  : "whitespace-pre-wrap text-sm"
            }
          >
            {l.text}
          </div>
        ))}
      </div>
      <ApprovalPrompt sessionPk={focusedSessionPk} />
      <Composer onSubmit={(t) => send(focusedSessionPk, t)} />
    </div>
  );
}
