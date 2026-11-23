import { cookies } from "next/headers";
import { contextForUser, createSession, deleteSession, readSessionUser } from "./auth";
import { newToken, tokenHash } from "./token";

const cookieName = "barberad_session";

async function attachSession(userId: string) {
  const token = newToken();
  await createSession(userId, tokenHash(token));
  const jar = await cookies();
  jar.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function startSession(userId: string) {
  await attachSession(userId);
}

export async function currentSessionHash() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  return token ? tokenHash(token) : null;
}

export async function getShopContext() {
  const hash = await currentSessionHash();
  if (!hash) return null;
  const userId = await readSessionUser(hash);
  if (!userId) return null;
  return contextForUser(userId);
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await deleteSession(tokenHash(token));
  jar.delete(cookieName);
}

// IP de quien hace la petición, según el proxy de la plataforma (Vercel, Railway…). En local, "local".
export async function clientIp() {
  const { headers } = await import("next/headers");
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip")?.trim() || "local";
}
