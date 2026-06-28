import { test, expect } from "bun:test";
import { runLoopbackAuth, type OidcClient, type OidcProfile } from "../src/main/oidc";
import type { TokenSet } from "../src/main/token-store";

const profile: OidcProfile = { issuer: "https://idp.test", clientId: "c", scopes: "openid" };

function mockClient(): OidcClient {
  return {
    startAuth: async (_p, redirectUri) => ({ authUrl: `${redirectUri}__authurl`, verifier: "v", state: "st", nonce: "no" }),
    exchange: async () => ({ accessToken: "at", refreshToken: "rt", expiresAt: Date.now() + 3_600_000 }) as TokenSet,
    refresh: async () => ({ accessToken: "at2", expiresAt: Date.now() + 3_600_000 }) as TokenSet,
  };
}

test("runLoopbackAuth opens the auth URL, captures the code, and exchanges it", async () => {
  let opened = "";
  const openExternal = (url: string) => {
    opened = url;
    // Simulate the browser hitting the loopback callback with the right state.
    const u = new URL(url.replace("__authurl", ""));
    fetch(`${u.origin}/callback?code=abc&state=st`).catch(() => {});
  };
  const set = await runLoopbackAuth(mockClient(), profile, openExternal, 5_000);
  expect(set.accessToken).toBe("at");
  expect(opened).toContain("/callback");
});

test("runLoopbackAuth rejects on state mismatch", async () => {
  const openExternal = (url: string) => {
    const u = new URL(url.replace("__authurl", ""));
    fetch(`${u.origin}/callback?code=abc&state=WRONG`).catch(() => {});
  };
  await expect(runLoopbackAuth(mockClient(), profile, openExternal, 5_000)).rejects.toThrow();
});

test("runLoopbackAuth rejects when code is missing from callback", async () => {
  const openExternal = (url: string) => {
    const u = new URL(url.replace("__authurl", ""));
    fetch(`${u.origin}/callback?state=st`).catch(() => {});
  };
  await expect(runLoopbackAuth(mockClient(), profile, openExternal, 5_000)).rejects.toThrow();
});
