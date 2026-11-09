import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasValidSession } from "@/lib/session-gate";
import { SESSION_COOKIE } from "@/lib/types";

const protectedPaths = ["/create", "/ads", "/business", "/account", "/admin"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const hasSession = await hasValidSession(token);
  const needsAuth = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (needsAuth && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    const response = NextResponse.redirect(login);
    if (token) clearSession(response);
    return response;
  }
  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  const response = NextResponse.next();
  if (token && !hasSession) clearSession(response);
  return response;
}

function clearSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

export const config = {
  matcher: ["/create/:path*", "/ads/:path*", "/business/:path*", "/account/:path*", "/admin/:path*", "/login", "/register"],
};
