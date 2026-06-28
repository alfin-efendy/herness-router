# @harness/ide — Electron Cockpit (milestone 2b)

`@harness/ide` is an Electron desktop app that connects to a locally running `hr serve` instance and provides a visual cockpit for managing Claude Code sessions.

## What's built (milestone 2b)

### Milestone 2a

- **Auto-discovery:** on startup the main process reads `~/.local/share/harness-router/serve.json` (written by `hr serve`) and connects via `@harness/client` over HTTP+WebSocket.
- **Connection indicator:** the top bar shows a dot that reflects the live WebSocket state (`connecting` → `open` / `closed`).
- **Projects / sessions tree:** left pane lists all projects returned by the router and the sessions under each; click a session to activate it.
- **Live transcript pane:** right pane streams `CoreEvent` objects (`status`, `text`, `result`, `approval`) for the active session in real time.
- **Session lifecycle controls:** start, continue (send a prompt), stop, and end a session via the IPC bridge without leaving the cockpit.
- **Typed IPC bridge:** a `contextBridge`-exposed `window.harness` object provides all renderer↔main calls; the shared `ipc-contract.ts` keeps types consistent across both sides.
- **Zustand store:** renderer state (projects, sessions, transcripts, connection) is managed in a single zustand store that is updated by IPC events.

### Milestone 2b

- **Interactive tool approvals:** when the router forwards a tool-approval request, an Allow/Deny card appears in the right rail with a live countdown timer; clicking Allow or Deny resolves the approval immediately and dismisses the card (timeout also auto-dismisses).
- **"+ Connect project" dialog:** a dialog in the left pane lets the user link a workspace to the router by entering a git URL or a local directory name; the IPC bridge calls `connectProject` which invokes `@harness/client` with the `ide` gateway and the current workspace ID.
- **Per-project "+ New session" dialog:** each project in the tree exposes a button that opens a dialog to start a new session, pre-scoped to that project.

## What is NOT built yet

- **Cloud OIDC connections** (milestone 2c) — only loopback bearer-token auth is wired; no PKCE browser flow or keychain storage.

## Prerequisites

A local `hr serve` must be running before you start the IDE:

```sh
bun run hr serve
```

That command writes `~/.local/share/harness-router/serve.json` which the IDE reads on launch.

## Dev commands

```sh
# from apps/ide/
bun run dev     # build + watch + launch Electron (hot reload)
bun run build   # one-shot build to dist/
bun run start   # launch Electron against an existing dist/
```

> **Note:** a display (X11 / WSLg) is required to run the Electron window. Headless / CI environments should rely on the unit and component tests (`bun test`) rather than a visual smoke test.

## Testing

```sh
bun test   # runs the full monorepo suite including IDE unit + component tests
```

Covered: `discoverLocalRouter`, IPC handlers, zustand store reducers, `ProjectsSessionsTree` / `SessionTranscript` / `TopBar` component rendering, `ApprovalsRail` (card rendering + countdown + Allow/Deny interaction), `ConnectProjectDialog`, and `NewSessionDialog`.

> **Note:** the GUI has not been headless-smoke-tested end-to-end; unit and component tests cover rendering and IPC call-arg assertions.
