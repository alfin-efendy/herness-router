import { useEffect } from "react";
import { useStore } from "./store";
import { useUi } from "./store-ui";
import { ProjectsTree } from "./components/ProjectsTree";
import { SessionTranscript } from "./components/SessionTranscript";
import { RightDock } from "./components/RightDock";
import { TitleBar } from "./components/shell/TitleBar";
import { useDisableContextMenu } from "./lib/contextMenu";
import { Badge, Toaster } from "@harness/ui";

export default function App() {
  const init = useStore((s) => s.init);
  const pending = useStore((s) => s.pendingApprovals.length);
  const { leftPanelOpen, rightPanelOpen } = useUi();
  const cols = `${leftPanelOpen ? "260px" : "0px"} 1fr ${rightPanelOpen ? "360px" : "0px"}`;
  useDisableContextMenu();
  useEffect(() => {
    init();
  }, [init]);
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TitleBar />
      {pending > 0 && (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-300">
          <Badge variant="secondary">{pending}</Badge> session(s) need approval
        </div>
      )}
      <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: cols }}>
        <aside className={`overflow-hidden border-r border-border ${leftPanelOpen ? "" : "hidden"}`}>
          <ProjectsTree />
        </aside>
        <main className="min-w-0">
          <SessionTranscript />
        </main>
        <aside className={`overflow-hidden border-l border-border ${rightPanelOpen ? "" : "hidden"}`}>
          <RightDock />
        </aside>
      </div>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
