import { colorEnabled } from "./colors";

const CODE: Record<string, number> = { accent: 36, signature: 35, ok: 32, warn: 33, bad: 31, dim: 90 };

export function paint(text: string, tone: keyof typeof CODE, opts?: { bold?: boolean }): string {
  if (!colorEnabled()) return text;
  const seq = (opts?.bold ? "1;" : "") + CODE[tone];
  return `\x1b[${seq}m${text}\x1b[0m`;
}
