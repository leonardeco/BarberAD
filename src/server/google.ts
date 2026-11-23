import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { appUrl } from "./mail";
import { sessionSecret } from "./token";

// Entrar o registrarse con Google (OAuth 2.0 con PKCE). Se activa con GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.
export function googleEnabled() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

// Las direcciones de Google se pueden cambiar solo para pruebas (un servidor falso que imita a Google).
const endpoints = {
  auth: () => process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth",
  token: () => process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token",
  userinfo: () => process.env.GOOGLE_USERINFO_URL || "https://openidconnect.googleapis.com/v1/userinfo",
};

export function googleRedirectUri() {
  return `${appUrl()}/auth/google/callback`;
}

export function newPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

export function googleAuthUrl(state: string, challenge: string) {
  const url = new URL(endpoints.auth());
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!.trim());
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export type GoogleProfile = { sub: string; email: string; name: string };

// Cambia el código por un token y lee el perfil directo de Google, por HTTPS: no hace falta validar firmas a mano.
export async function googleProfile(code: string, verifier: string): Promise<GoogleProfile | null> {
  const tokenResponse = await fetch(endpoints.token(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenResponse.ok) return null;
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) return null;
  const profileResponse = await fetch(endpoints.userinfo(), {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!profileResponse.ok) return null;
  const profile = (await profileResponse.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
  if (!profile.sub || !profile.email || profile.email_verified !== true) return null;
  return { sub: profile.sub, email: profile.email.toLowerCase(), name: (profile.name ?? "").slice(0, 80) };
}

// Datos de Google firmados en una cookie mientras la persona termina el registro (10 minutos).
export function signPending(profile: GoogleProfile) {
  const payload = Buffer.from(JSON.stringify({ ...profile, exp: Date.now() + 10 * 60 * 1000 })).toString("base64url");
  const mac = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function readPending(value: string | undefined): GoogleProfile | null {
  if (!value) return null;
  const [payload, mac] = value.split(".");
  if (!payload || !mac) return null;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as GoogleProfile & { exp: number };
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { sub: data.sub, email: data.email, name: data.name };
  } catch {
    return null;
  }
}
