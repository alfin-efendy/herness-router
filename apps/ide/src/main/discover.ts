import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface RouterInfo {
  url: string;
  token: string;
}

export function serveInfoFile(): string {
  const home = process.env.HOME ?? ".";
  return join(home, ".local/share/harness-router/serve.json");
}

// readFileImpl is injectable for tests; defaults to reading serveInfoFile().
export function discoverLocalRouter(readFileImpl: (p: string) => string = (p) => readFileSync(p, "utf8")): RouterInfo | null {
  try {
    const raw = readFileImpl(serveInfoFile());
    const parsed = JSON.parse(raw) as Partial<RouterInfo>;
    if (typeof parsed.url === "string" && typeof parsed.token === "string") {
      return { url: parsed.url, token: parsed.token };
    }
    return null;
  } catch {
    return null;
  }
}
