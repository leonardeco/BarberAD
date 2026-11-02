import { NextResponse } from "next/server";

export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/entrar", request.url));
  response.cookies.delete("barberad_session");
  return response;
}
