import { test, expect } from "bun:test";
import { IPC_COMMANDS, CONNECTIONS_CHANNEL, type ConnectionSummary, type AddConnectionInput } from "../src/shared/ipc-contract";

test("IPC_COMMANDS includes the 2c connection commands", () => {
  const commands = [
    "listConnections" as const,
    "addConnection" as const,
    "removeConnection" as const,
    "selectConnection" as const,
    "signIn" as const,
    "signOut" as const,
  ];
  for (const c of commands) {
    expect(IPC_COMMANDS).toContain(c);
  }
});

test("CONNECTIONS_CHANNEL constant", () => {
  expect(CONNECTIONS_CHANNEL).toBe("harness:connections");
});
