# @harness/protocol

Shared, runtime-free **contracts** for the harness monorepo: domain models (`Project`, `Session`, `Surface`), event types (`CoreEvent`), permission/approval types, and the `ControlPlaneApi` interface.

Everyone imports from here so the router (server) and the mission-control / ide / mobile clients speak the same shapes. Keep this package **types-only** (no Node/Bun runtime deps) so any client — including mobile — can consume it.
