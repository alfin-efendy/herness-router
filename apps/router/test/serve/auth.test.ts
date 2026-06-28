// apps/router/test/serve/auth.test.ts
import { test, expect } from "bun:test";
import { SignJWT, generateKeyPair, exportJWK } from "jose";
import { openDb } from "../../src/store/db";
import { SettingsStore } from "../../src/config/store";
import { createAuthenticator } from "../../src/serve/auth";

test("loopback mode accepts the local token and rejects others", async () => {
  const settings = new SettingsStore(openDb(":memory:"));
  const auth = createAuthenticator({ settings, localToken: "secret" });
  expect(await auth.authenticate("Bearer secret")).toEqual({ actor: "local" });
  expect(await auth.authenticate("Bearer wrong")).toBeNull();
  expect(await auth.authenticate(null)).toBeNull();
});

test("WS tickets are single-use", async () => {
  const settings = new SettingsStore(openDb(":memory:"));
  const auth = createAuthenticator({ settings, localToken: "secret" });
  const t = auth.issueTicket("local");
  expect(auth.consumeTicket(t)).toEqual({ actor: "local" });
  expect(auth.consumeTicket(t)).toBeNull();
});

test("oidc mode verifies a JWT against a JWKS and checks aud", async () => {
  const settings = new SettingsStore(openDb(":memory:"));
  settings.set("serve.auth_mode", "oidc");
  settings.set("oidc.issuer", "https://idp.test");
  settings.set("oidc.audience", "harness");
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "k1";
  // Inject the JWKS directly so the test does not hit the network.
  const auth = createAuthenticator({ settings, localToken: "x", jwksOverride: { keys: [jwk] } });
  const token = await new SignJWT({ sub: "user@idp" })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer("https://idp.test")
    .setAudience("harness")
    .setExpirationTime("5m")
    .sign(privateKey);
  expect(await auth.authenticate(`Bearer ${token}`)).toEqual({ actor: "user@idp" });
  const badAud = await new SignJWT({ sub: "u" })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer("https://idp.test")
    .setAudience("other")
    .setExpirationTime("5m")
    .sign(privateKey);
  expect(await auth.authenticate(`Bearer ${badAud}`)).toBeNull();
});
