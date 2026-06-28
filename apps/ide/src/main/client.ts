// apps/ide/src/main/client.ts
import { createControlPlaneClient, type RemoteControlPlane } from "@harness/client";
import { EVENT_CHANNEL, CONNECTION_CHANNEL } from "../shared/ipc-contract";
import type { RouterInfo } from "./discover";

export interface ClientHandle {
  client: RemoteControlPlane;
  connect(): Promise<void>;
  dispose(): void;
}

export function createSession(deps: { info: RouterInfo; send: (channel: string, payload: unknown) => void }): ClientHandle {
  const client = createControlPlaneClient({
    baseUrl: deps.info.url,
    getToken: async () => deps.info.token,
  });
  const offEvent = client.onEvent((e) => deps.send(EVENT_CHANNEL, e));
  const offConn = client.onConnectionChange((s) => deps.send(CONNECTION_CHANNEL, s));
  return {
    client,
    connect: () => client.connect(),
    dispose: () => {
      offEvent();
      offConn();
      client.close();
    },
  };
}
