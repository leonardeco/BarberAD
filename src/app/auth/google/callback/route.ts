import { NextResponse, type NextRequest } from "next/server";
import { contextForUser, findUserByGoogle } from "@/server/auth";
import { googleEnabled, googleProfile, signPending } from "@/server/google";
import { startSession } from "@/server/session";

function back(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.cookies.delete({ name: "barberad_oauth_state", path: "/auth/google" });
  response.cookies.delete({ name: "barberad_oauth_verifier", path: "/auth/google" });
  return response;
}

export async function GET(request: NextRequest) {
  if (!googleEnabled()) return back(request, "/entrar");
  const params = request.nextUrl.searchParams;
  const state = request.cookies.get("barberad_oauth_state")?.value;
  const verifier = request.cookies.get("barberad_oauth_verifier")?.value;
  const code = params.get("code");
  if (!code || !state || !verifier || params.get("state") !== state) return back(request, "/entrar?google=error");

  const profile = await googleProfile(code, verifier).catch(() => null);
  if (!profile) return back(request, "/entrar?google=error");

  const userId = await findUserByGoogle(profile.sub, profile.email);
  if (userId) {
    if (!(await contextForUser(userId))) return back(request, "/entrar?google=inactivo");
    await startSession(userId);
    return back(request, "/hoy");
  }
  const response = back(request, "/registro/google");
  response.cookies.set("barberad_google_signup", signPending(profile), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/registro",
    maxAge: 600,
  });
  return response;
}
