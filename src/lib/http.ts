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

function hostnameOf(value: string): string | null {
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    const host = url.hostname.toLowerCase();
    return host === "localhost" ? "127.0.0.1" : host;
  } catch {
    return null;
  }
}

function requestHostnames(request: Request): Set<string> {
  const hosts = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (!value) return;
    for (const part of value.split(",")) {
      const host = hostnameOf(part.trim());
      if (host) hosts.add(host);
    }
  };
  add(request.url);
  add(request.headers.get("host"));
  add(request.headers.get("x-forwarded-host"));
  add(request.headers.get("x-original-host"));
  const forwarded = request.headers.get("forwarded");
  if (forwarded) {
    for (const match of forwarded.matchAll(/(?:^|[;,]\s*)host="?([^";,\s]+)"?/gi)) {
      add(match[1]);
    }
  }
  return hosts;
}

export function sameOrigin(request: Request): boolean {
  const method = request.method.toUpperCase();
  const site = (request.headers.get("sec-fetch-site") ?? "").toLowerCase();
  // Browser fetch from the hosted page is same-origin even when the platform
  // rewrites Host / request.url to an internal address behind TLS.
  if (site === "same-origin") return true;
  if (site === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    return method === "GET" || method === "HEAD";
  }
  const originHost = hostnameOf(origin);
  if (!originHost) return false;
  return requestHostnames(request).has(originHost);
}

export async function setLangCookie(request: Request, language: Language) {
  const store = await cookies();
  store.set(LANG_COOKIE, language, {
    ...cookieOptions(request, false),
    maxAge: 60 * 60 * 24 * 365,
  });
}

export { SESSION_COOKIE, CSRF_COOKIE, LANG_COOKIE };
