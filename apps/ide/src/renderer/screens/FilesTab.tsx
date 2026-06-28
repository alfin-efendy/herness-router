import React, { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { loadLanguage } from "@uiw/codemirror-extensions-langs";
import { useStore } from "../store";
import type { DirEntry } from "../../shared/ipc-contract";

function langExt(path: string) {
  const ext = path.split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    py: "python",
    go: "go",
    rs: "rust",
    sh: "shell",
    yml: "yaml",
    yaml: "yaml",
  };
  const lang = map[ext];
  const e = lang ? loadLanguage(lang as never) : null;
  return e ? [e] : [];
}

function Node({
  sessionPk,
  name,
  path,
  type,
  depth,
}: {
  sessionPk: string;
  name: string;
  path: string;
  type: "file" | "dir";
  depth: number;
}) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const setOpenFile = useStore((s) => s.setOpenFile);
  const openFilePath = useStore((s) => s.openFilePath);

  async function toggle() {
    if (type === "dir") {
      if (!open && children === null) setChildren(await window.harness.listDir({ sessionPk, path }));
      setOpen((o) => !o);
    } else {
      setOpenFile(path, await window.harness.readFile({ sessionPk, path }));
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => void toggle()}
        className={`flex w-full items-center gap-1 px-2 py-0.5 text-left text-xs hover:bg-accent ${openFilePath === path ? "bg-accent" : ""}`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <span>{type === "dir" ? (open ? "▾" : "▸") : "·"}</span>
        <span className="truncate">{name}</span>
      </button>
      {open &&
        children?.map((c) => (
          <Node
            key={c.name}
            sessionPk={sessionPk}
            name={c.name}
            path={path ? `${path}/${c.name}` : c.name}
            type={c.type}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export function FilesTab() {
  const sessionPk = useStore((s) => s.activeSessionPk);
  const openFile = useStore((s) => s.openFile);
  const openFilePath = useStore((s) => s.openFilePath);
  const [root, setRoot] = useState<DirEntry[] | null>(null);

  useEffect(() => {
    setRoot(null);
    if (!sessionPk) return;
    let cancelled = false;
    window.harness.listDir({ sessionPk, path: "" }).then((entries) => {
      if (!cancelled) setRoot(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionPk]);

  if (!sessionPk) return <p className="p-3 text-xs text-muted-foreground">Select a session to browse its files.</p>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="max-h-48 shrink-0 overflow-auto border-b">
        {root?.map((e) => (
          <Node key={e.name} sessionPk={sessionPk} name={e.name} path={e.name} type={e.type} depth={0} />
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {openFile == null ? (
          <p className="p-3 text-xs text-muted-foreground">Select a file.</p>
        ) : openFile.binary ? (
          <p className="p-3 text-xs text-muted-foreground">Binary file — not shown.</p>
        ) : (
          <>
            {openFile.truncated && <p className="p-2 text-xs text-yellow-600">Truncated at 2 MB.</p>}
            <CodeMirror value={openFile.content} readOnly editable={false} extensions={openFilePath ? langExt(openFilePath) : []} />
          </>
        )}
      </div>
    </div>
  );
}
