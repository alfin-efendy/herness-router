import { expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultDbPath } from "../../src/cli/index";

function tmpHome(): string {
  const dir = join(tmpdir(), `ryuzi-home-${Bun.hash(Math.random().toString())}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const legacyName = "har" + "ness";
const legacyDbName = `${legacyName}.sqlite`;

test("defaultDbPath uses the ryuzi data directory", () => {
  const home = tmpHome();
  try {
    expect(defaultDbPath({ HOME: home })).toBe(`${home}/.local/share/ryuzi/ryuzi.sqlite`);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("defaultDbPath copies legacy sqlite, wal, and shm files once", () => {
  const home = tmpHome();
  try {
    const legacy = `${home}/.local/share/${legacyName}-router`;
    mkdirSync(legacy, { recursive: true });
    writeFileSync(`${legacy}/${legacyDbName}`, "legacy-db");
    writeFileSync(`${legacy}/${legacyDbName}-wal`, "legacy-wal");
    writeFileSync(`${legacy}/${legacyDbName}-shm`, "legacy-shm");
    const path = defaultDbPath({ HOME: home });
    expect(path).toBe(`${home}/.local/share/ryuzi/ryuzi.sqlite`);
    expect(readFileSync(`${home}/.local/share/ryuzi/ryuzi.sqlite`, "utf8")).toBe("legacy-db");
    expect(readFileSync(`${home}/.local/share/ryuzi/ryuzi.sqlite-wal`, "utf8")).toBe("legacy-wal");
    expect(readFileSync(`${home}/.local/share/ryuzi/ryuzi.sqlite-shm`, "utf8")).toBe("legacy-shm");
    writeFileSync(`${home}/.local/share/ryuzi/ryuzi.sqlite`, "new-db");
    writeFileSync(`${home}/.local/share/ryuzi/ryuzi.sqlite-wal`, "new-wal");
    writeFileSync(`${home}/.local/share/ryuzi/ryuzi.sqlite-shm`, "new-shm");
    defaultDbPath({ HOME: home });
    expect(readFileSync(`${home}/.local/share/ryuzi/ryuzi.sqlite`, "utf8")).toBe("new-db");
    expect(readFileSync(`${home}/.local/share/ryuzi/ryuzi.sqlite-wal`, "utf8")).toBe("new-wal");
    expect(readFileSync(`${home}/.local/share/ryuzi/ryuzi.sqlite-shm`, "utf8")).toBe("new-shm");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("defaultDbPath preserves an existing ryuzi database without copying legacy sidecars", () => {
  const home = tmpHome();
  try {
    const legacy = `${home}/.local/share/${legacyName}-router`;
    const next = `${home}/.local/share/ryuzi`;
    mkdirSync(legacy, { recursive: true });
    mkdirSync(next, { recursive: true });
    writeFileSync(`${legacy}/${legacyDbName}`, "legacy-db");
    writeFileSync(`${legacy}/${legacyDbName}-wal`, "legacy-wal");
    writeFileSync(`${legacy}/${legacyDbName}-shm`, "legacy-shm");
    writeFileSync(`${next}/ryuzi.sqlite`, "existing-db");

    defaultDbPath({ HOME: home });

    expect(readFileSync(`${next}/ryuzi.sqlite`, "utf8")).toBe("existing-db");
    expect(existsSync(`${next}/ryuzi.sqlite-wal`)).toBe(false);
    expect(existsSync(`${next}/ryuzi.sqlite-shm`)).toBe(false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
