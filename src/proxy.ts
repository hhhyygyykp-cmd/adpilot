import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/types";

const protectedPaths = ["/create", "/ads", "/business", "/account", "/admin"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const needsAuth = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (needsAuth && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/create/:path*", "/ads/:path*", "/business/:path*", "/account/:path*", "/admin/:path*", "/login", "/register"],
};
