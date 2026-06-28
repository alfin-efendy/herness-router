import { test, expect } from "bun:test";
import { useStore } from "../src/renderer/store";

test("setConnections replaces the list", () => {
  useStore.getState().setConnections([
    {
      id: "local",
      label: "Local (hr serve)",
      baseUrl: "http://127.0.0.1:8787",
      authMode: "loopback",
      active: true,
      signedIn: true,
    },
  ]);
  expect(useStore.getState().connections.map((c) => c.id)).toEqual(["local"]);
});
