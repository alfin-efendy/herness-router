import { openDb } from "../store/db";
import { SettingsStore } from "../config/store";
import { SETTING_DEFS } from "../config/schema";
import type { CliDeps } from "./run";

export async function runInit(deps: CliDeps): Promise<number> {
  const settings = new SettingsStore(openDb(deps.dbPath));
  deps.io.out("harness init — press Enter to keep the [default].");

  for (const [key, def] of Object.entries(SETTING_DEFS)) {
    const current = settings.get(key);
    const shown = def.secret && current ? "•".repeat(8) : current ?? "";
    const answer = (await deps.io.prompt(`${key}${def.required ? " (required)" : ""} [${shown}]: `)).trim();
    if (answer === "") continue;
    try {
      settings.set(key, answer);
    } catch (e) {
      deps.io.err((e as Error).message);
      return 1;
    }
  }

  const missing = settings.missingRequired();
  if (missing.length) {
    deps.io.err(`still missing required: ${missing.join(", ")}`);
    return 1;
  }
  deps.io.out("init: settings saved. Run `harness doctor` to verify your environment.");
  return 0;
}
