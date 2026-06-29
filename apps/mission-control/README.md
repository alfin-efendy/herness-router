# @harness/mission-control (planned)

Web app to remotely view and control **all** workdirs and sessions across gateways.

Will connect to the router over the `ControlPlaneApi` (WebSocket transport, served by the `hr` daemon (`@harness/cli`) via `Bun.serve()`) and consume `@harness/protocol` types. Not implemented yet — reserved as a workspace so the name and seam exist.
