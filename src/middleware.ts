import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const shopPaths = ["/hoy", "/cobrar", "/servicios", "/equipo", "/caja", "/cuenta"];

export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get("barberad_session"));
  const path = request.nextUrl.pathname;
  if (shopPaths.some((item) => path === item || path.startsWith(`${item}/`)) && !hasSession) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }
  if ((path === "/entrar" || path === "/registro") && hasSession) {
    return NextResponse.redirect(new URL("/hoy", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/hoy",
    "/cobrar/:path*",
    "/servicios/:path*",
    "/equipo/:path*",
    "/caja/:path*",
    "/cuenta/:path*",
    "/entrar",
    "/registro",
  ],
};
