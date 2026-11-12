import "server-only";

export {
  FACEBOOK_GRAPH_HOST,
  FACEBOOK_GRAPH_VERSION,
  FACEBOOK_OAUTH_DIALOG,
  HOSTED_CALLBACK,
  HOSTED_ORIGIN,
  instagramAppReturnUrl,
  META_APP_ID_NAME,
  META_APP_SECRET_NAME,
  META_CONFIGURATION_ID_NAME,
  META_PUBLIC_ORIGIN_NAME,
  REQUIRED_SECRET_NAMES,
  TARGET_INSTAGRAM_USERNAME,
  UNIFIED_PERMISSIONS,
  missingMetaSecretsFrom,
  normalizeInstagramUsername,
} from "./oauth";

import {
  FACEBOOK_GRAPH_HOST,
  FACEBOOK_GRAPH_VERSION,
  HOSTED_CALLBACK,
  HOSTED_ORIGIN,
  missingMetaSecretsFrom,
} from "./oauth";

export function metaAppId(): string {
  return (process.env.META_APP_ID ?? "").trim();
}

export function metaAppSecret(): string {
  return (process.env.META_APP_SECRET ?? "").trim();
}

export function metaConfigurationId(): string {
  return (process.env.META_CONFIGURATION_ID ?? "").trim();
}

export function metaPublicOriginOverride(): string {
  return (process.env.META_PUBLIC_ORIGIN ?? "").trim().replace(/\/$/, "");
}

export function missingMetaSecrets(): string[] {
  return missingMetaSecretsFrom(process.env);
}

export function metaConfigured(): boolean {
  return missingMetaSecrets().length === 0;
}

export function instagramRedirectPath(): string {
  return "/api/admin/instagram/callback";
}

export function hostedOrigin(): string {
  return metaPublicOriginOverride() || HOSTED_ORIGIN;
}

export function publicOriginFromRequest(request: Request): string {
  const override = metaPublicOriginOverride();
  if (override) return override;
  return HOSTED_ORIGIN;
}

export function instagramRedirectUri(): string {
  return HOSTED_CALLBACK;
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
  return `${FACEBOOK_GRAPH_HOST}/${FACEBOOK_GRAPH_VERSION}${trimmed}`;
}
