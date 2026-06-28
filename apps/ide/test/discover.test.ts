import { test, expect } from "bun:test";
import { discoverLocalRouter } from "../src/main/discover";

function fakeReader(map: Record<string, string>): (p: string) => string {
  return (p: string): string => {
    if (p in map) return map[p]!;
    throw new Error("ENOENT");
  };
}

test("returns {url,token} when serve.json is present and valid", () => {
  const path = `${process.env.HOME}/.local/share/harness-router/serve.json`;
  const got = discoverLocalRouter(
    fakeReader({
      [path]: JSON.stringify({
        url: "http://127.0.0.1:8787",
        token: "t",
      }),
    }),
  );
  expect(got).toEqual({ url: "http://127.0.0.1:8787", token: "t" });
});

test("returns null when the file is absent", () => {
  expect(discoverLocalRouter(fakeReader({}))).toBeNull();
});

test("returns null when the file is malformed", () => {
  const path = `${process.env.HOME}/.local/share/harness-router/serve.json`;
  expect(discoverLocalRouter(fakeReader({ [path]: "not json" }))).toBeNull();
});
