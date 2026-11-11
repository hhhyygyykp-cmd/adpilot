import "server-only";

export const INSTAGRAM_GRAPH_VERSION = "v22.0";
export const INSTAGRAM_GRAPH_HOST = "https://graph.instagram.com";
export const INSTAGRAM_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
export const INSTAGRAM_SHORT_LIVED_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
] as const;

export const META_APP_ID_NAME = "META_APP_ID";
export const META_APP_SECRET_NAME = "META_APP_SECRET";
export const META_PUBLIC_ORIGIN_NAME = "META_PUBLIC_ORIGIN";

export function metaAppId(): string {
  return (process.env.META_APP_ID ?? "").trim();
}

export function metaAppSecret(): string {
  return (process.env.META_APP_SECRET ?? "").trim();
}

export function metaConfigured(): boolean {
  return Boolean(metaAppId() && metaAppSecret());
}

export function metaPublicOriginOverride(): string {
  return (process.env.META_PUBLIC_ORIGIN ?? "").trim().replace(/\/$/, "");
}

export function instagramRedirectPath(): string {
  return "/api/admin/instagram/callback";
}

export function publicOriginFromRequest(request: Request): string {
  const override = metaPublicOriginOverride();
  if (override) return override;
  const url = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "") ||
    "http";
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    url.host;
  return `${proto}://${host}`;
}

export function instagramRedirectUri(request: Request): string {
  return `${publicOriginFromRequest(request)}${instagramRedirectPath()}`;
}

export function originIsPublicHttps(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    if (host.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
  }
}

export function graphUrl(path: string): string {
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  return `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_GRAPH_VERSION}${trimmed}`;
}
