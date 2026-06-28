import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { TokenSet } from "./token-store";

export interface OidcProfile {
  issuer: string;
  clientId: string;
  scopes: string;
}

export interface OidcClient {
  startAuth(p: OidcProfile, redirectUri: string): Promise<{ authUrl: string; verifier: string; state: string; nonce: string }>;
  exchange(p: OidcProfile, redirectUri: string, code: string, ctx: { verifier: string; state: string; nonce: string }): Promise<TokenSet>;
  refresh(p: OidcProfile, refreshToken: string): Promise<TokenSet>;
}

export async function runLoopbackAuth(
  oidc: OidcClient,
  p: OidcProfile,
  openExternal: (url: string) => void,
  timeoutMs = 180_000,
): Promise<TokenSet> {
  return new Promise<TokenSet>((resolve, reject) => {
    const server = createServer();
    let timer: ReturnType<typeof setTimeout>;
    const done = (fn: () => void) => {
      clearTimeout(timer);
      server.close();
      fn();
    };
    let redirectUri = "";
    let auth: { authUrl: string; verifier: string; state: string; nonce: string };

    server.on("request", async (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        res.statusCode = 404;
        res.end();
        return;
      }
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || state !== auth.state) {
        res.statusCode = 400;
        res.end("invalid callback");
        done(() => reject(new Error("oidc callback: invalid state or missing code")));
        return;
      }
      try {
        const set = await oidc.exchange(p, redirectUri, code, auth);
        res.statusCode = 200;
        res.end("Signed in. You can close this tab.");
        done(() => resolve(set));
      } catch (e) {
        res.statusCode = 500;
        res.end("token exchange failed");
        done(() => reject(e as Error));
      }
    });

    server.listen(0, "127.0.0.1");

    server.on("listening", async () => {
      try {
        const port = (server.address() as AddressInfo).port;
        redirectUri = `http://127.0.0.1:${port}/callback`;
        auth = await oidc.startAuth(p, redirectUri);
        timer = setTimeout(() => done(() => reject(new Error("oidc sign-in timed out"))), timeoutMs);
        openExternal(auth.authUrl);
      } catch (e) {
        done(() => reject(e as Error));
      }
    });

    server.on("error", (e) => done(() => reject(e)));
  });
}

// Real OIDC client over `openid-client` v6 (functional API).
// This is the ONLY openid-client touchpoint.
// v6 API: discovery(), randomPKCECodeVerifier(), calculatePKCECodeChallenge(),
//         randomNonce(), randomState(), buildAuthorizationUrl(),
//         authorizationCodeGrant(), refreshTokenGrant(), None().
// Maps to OidcClient seam; expiresAt = Date.now() + (expires_in ?? 3600) * 1000.
// Caches Configuration (discovered metadata) per issuer URL. Public client (None auth method).
export function createOidcClient(): OidcClient {
  // Cache per issuer to avoid repeated discovery round-trips.
  const configCache = new Map<string, import("openid-client").Configuration>();

  async function getConfig(issuer: string, clientId: string): Promise<import("openid-client").Configuration> {
    const key = `${issuer}::${clientId}`;
    const cached = configCache.get(key);
    if (cached) return cached;

    const { discovery, None } = await import("openid-client");
    const config = await discovery(new URL(issuer), clientId, { token_endpoint_auth_method: "none" }, None());
    configCache.set(key, config);
    return config;
  }

  return {
    async startAuth(p, redirectUri) {
      const { randomPKCECodeVerifier, calculatePKCECodeChallenge, randomNonce, randomState, buildAuthorizationUrl } = await import(
        "openid-client"
      );

      const config = await getConfig(p.issuer, p.clientId);
      const verifier = randomPKCECodeVerifier();
      const codeChallenge = await calculatePKCECodeChallenge(verifier);
      const state = randomState();
      const nonce = randomNonce();

      const authUrl = buildAuthorizationUrl(config, {
        redirect_uri: redirectUri,
        scope: p.scopes,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
        nonce,
        response_type: "code",
      });

      return { authUrl: authUrl.href, verifier, state, nonce };
    },

    async exchange(p, redirectUri, code, ctx) {
      const { authorizationCodeGrant } = await import("openid-client");
      const config = await getConfig(p.issuer, p.clientId);

      // Build a synthetic URL that includes the code + state so authorizationCodeGrant can parse it.
      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", ctx.state);

      const tokens = await authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: ctx.verifier,
        expectedNonce: ctx.nonce,
        expectedState: ctx.state,
      });

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
        idToken: tokens.id_token,
      };
    },

    async refresh(p, refreshToken) {
      const { refreshTokenGrant } = await import("openid-client");
      const config = await getConfig(p.issuer, p.clientId);

      const tokens = await refreshTokenGrant(config, refreshToken);

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
        idToken: tokens.id_token,
      };
    },
  };
}
