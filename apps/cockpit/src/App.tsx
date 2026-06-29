import { useEffect } from "react";
import { useStore } from "./store";
import { ProjectsTree } from "./components/ProjectsTree";
import { SessionTranscript } from "./components/SessionTranscript";

export default function App() {
  const init = useStore((s) => s.init);
  useEffect(() => { init(); }, [init]);
  return (
    <div className="grid h-screen grid-cols-[260px_1fr] bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className="border-r border-zinc-200 dark:border-zinc-800"><ProjectsTree /></aside>
      <main className="min-w-0"><SessionTranscript /></main>
    </div>
  );
}
