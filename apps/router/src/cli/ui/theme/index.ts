import { palette } from "./tokens";

export { palette, symbolsUnicode, symbolsAscii } from "./tokens";
export { symbols, borderStyle, colorEnabled, unicodeEnabled } from "./colors";
export { paint } from "./paint";

// Back-compat: existing components import `{ theme }` and read .ok/.accent/etc.
export const theme = {
  ok: palette.ok,
  bad: palette.bad,
  dim: palette.dim,
  accent: palette.accent,
  warn: palette.warn,
  text: palette.text,
  signature: palette.signature,
  border: palette.border,
} as const;
