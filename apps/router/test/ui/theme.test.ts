// apps/router/test/ui/theme.test.ts
import { test, expect } from "bun:test";
import { palette, theme, symbols, borderStyle, colorEnabled, paint } from "../../src/cli/ui/theme";

test("palette and back-compat theme expose hex tokens", () => {
  expect(palette.signature).toBe("#ff2d95");
  expect(theme.accent).toBe(palette.accent); // existing code reads theme.accent
  expect(theme.ok).toBe(palette.ok);
});

test("symbols default to unicode, ascii only under HR_ASCII", () => {
  delete process.env.HR_ASCII;
  expect(symbols().dot).toBe("●");
  expect(borderStyle()).toBe("round");
  process.env.HR_ASCII = "1";
  expect(symbols().dot).toBe("*");
  expect(borderStyle()).toBe("single");
  delete process.env.HR_ASCII;
});

test("paint is plain when color disabled (non-TTY test env)", () => {
  // bun test stdout is not a TTY → colorEnabled() is false → no escape codes
  expect(colorEnabled()).toBe(false);
  expect(paint("PASS", "ok", { bold: true })).toBe("PASS");
});
