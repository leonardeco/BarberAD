import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { contextForUser, createSession, deleteSession, readSessionUser } from "./auth";
import { required } from "./env";

const cookieName = "barberad_session";

function tokenHash(token: string) {
  return createHash("sha256").update(`${required("SESSION_SECRET")}:${token}`).digest("hex");
}

async function attachSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
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

export async function getShopContext() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (!token) return null;
  const userId = await readSessionUser(tokenHash(token));
  if (!userId) return null;
  return contextForUser(userId);
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await deleteSession(tokenHash(token));
  jar.delete(cookieName);
}
