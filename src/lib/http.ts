import { cookies } from "next/headers";
import { CSRF_COOKIE, LANG_COOKIE, SESSION_COOKIE } from "./types";
import type { Language } from "./types";

export function json(data: unknown, status = 200, extra?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      ...extra,
    },
  });
}

export function errorJson(message: string, status = 400, extra?: object) {
  return json({ error: message, ...extra }, status);
}

export function isSecureRequest(request: Request): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0]?.trim() === "https";
  return new URL(request.url).protocol === "https:";
}

export function cookieOptions(request: Request, httpOnly: boolean) {
  return {
    httpOnly,
    secure: isSecureRequest(request),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  };
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function canonicalOrigin(value: string): string {
  const url = new URL(value);
  if (url.hostname === "localhost") url.hostname = "127.0.0.1";
  return url.origin;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    const method = request.method.toUpperCase();
    return method === "GET" || method === "HEAD";
  }
  try {
    const incoming = canonicalOrigin(origin);
    if (incoming === canonicalOrigin(request.url)) return true;
    const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      new URL(request.url).protocol.replace(":", "");
    if (!host) return false;
    return incoming === canonicalOrigin(`${proto}://${host}`);
  } catch {
    return false;
  }
}

export async function setLangCookie(request: Request, language: Language) {
  const store = await cookies();
  store.set(LANG_COOKIE, language, {
    ...cookieOptions(request, false),
    maxAge: 60 * 60 * 24 * 365,
  });
}

export { SESSION_COOKIE, CSRF_COOKIE, LANG_COOKIE };
