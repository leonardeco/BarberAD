import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const shopPaths = ["/hoy", "/agenda", "/avisos", "/plan", "/clientes", "/horarios", "/mas", "/reportes", "/liquidar", "/cobrar", "/servicios", "/equipo", "/caja", "/cuenta"];

export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get("barberad_session"));
  const path = request.nextUrl.pathname;
  if (shopPaths.some((item) => path === item || path.startsWith(`${item}/`)) && !hasSession) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }
  if ((path === "/entrar" || path === "/registro" || path === "/registro/google") && hasSession) {
    return NextResponse.redirect(new URL("/hoy", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/hoy",
    "/agenda/:path*",
    "/avisos/:path*",
    "/plan/:path*",
    "/clientes/:path*",
    "/horarios/:path*",
    "/mas/:path*",
    "/reportes/:path*",
    "/liquidar/:path*",
    "/cobrar/:path*",
    "/servicios/:path*",
    "/equipo/:path*",
    "/caja/:path*",
    "/cuenta/:path*",
    "/entrar",
    "/registro",
    "/registro/google",
  ],
};
