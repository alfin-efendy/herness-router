import { test, expect } from "bun:test";
import { resolveDark, accentVars, ACCENTS } from "./theme";

test("resolveDark truth table", () => {
  expect(resolveDark("light", true)).toBe(false);
  expect(resolveDark("dark", false)).toBe(true);
  expect(resolveDark("system", true)).toBe(true);
  expect(resolveDark("system", false)).toBe(false);
});

test("accentVars: neutral clears, a key maps --primary, custom hex maps + luminance fg", () => {
  expect(accentVars("neutral")).toEqual({});
  const indigo = accentVars("indigo");
  expect(indigo["--primary"]).toBe(ACCENTS.find((a) => a.key === "indigo")!.primary);
  expect(indigo["--ring"]).toBe(indigo["--primary"]);
  const darkCustom = accentVars({ custom: "#101010" });
  expect(darkCustom["--primary"]).toBe("#101010");
  expect(darkCustom["--primary-foreground"]).toBe("oklch(0.98 0 0)"); // light fg on dark accent
  const lightCustom = accentVars({ custom: "#eeeeee" });
  expect(lightCustom["--primary-foreground"]).toBe("oklch(0.2 0 0)"); // dark fg on light accent
});
