import { test, expect } from "bun:test";
import { useStore } from "../src/renderer/store";

test("setOpenFile sets path + content; setActive clears it", () => {
  useStore.getState().setOpenFile("src/app.ts", {
    content: "x",
    encoding: "utf8",
    binary: false,
    truncated: false,
  });
  expect(useStore.getState().openFilePath).toBe("src/app.ts");
  expect(useStore.getState().openFile?.content).toBe("x");
  useStore.getState().setActive("other-session");
  expect(useStore.getState().openFilePath).toBeNull();
  expect(useStore.getState().openFile).toBeNull();
});
