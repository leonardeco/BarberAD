import { NextResponse } from "next/server";
import { googleAuthUrl, googleEnabled, newPkce } from "@/server/google";

export async function GET(request: Request) {
  if (!googleEnabled()) return NextResponse.redirect(new URL("/entrar", request.url));
  const { verifier, challenge, state } = newPkce();
  const response = NextResponse.redirect(googleAuthUrl(state, challenge));
  const cookie = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/auth/google", maxAge: 600 };
  response.cookies.set("barberad_oauth_state", state, cookie);
  response.cookies.set("barberad_oauth_verifier", verifier, cookie);
  return response;
}
