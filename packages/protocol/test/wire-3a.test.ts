import { test, expect } from "bun:test";
import { RPC_METHODS } from "../src/wire";

test("RPC_METHODS includes the 3a file methods", () => {
  expect(RPC_METHODS).toContain("listDir");
  expect(RPC_METHODS).toContain("readFile");
});
