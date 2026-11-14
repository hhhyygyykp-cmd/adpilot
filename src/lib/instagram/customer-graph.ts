import "server-only";

import {
  FACEBOOK_GRAPH_HOST,
  FACEBOOK_GRAPH_VERSION,
  metaAppId,
  metaAppSecret,
} from "./config";
import { InstagramApiError, instagramGet, publicInstagramError } from "./meta";
import { CUSTOMER_UNIFIED_PERMISSIONS } from "./customer-oauth";
import { igUserProfileFields, nonexistingFieldFromGraphError, withoutGraphField } from "./discovery";

type GraphErrorBody = {
  error?: { message?: string; type?: string; code?: number; error_user_msg?: string };
};

function stripSecrets(text: string): string {
  return text
    .replace(/access_token=[^&\s]+/gi, "access_token=[redacted]")
    .replace(/client_secret=[^&\s]+/gi, "client_secret=[redacted]");
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InstagramApiError(
      `Instagram returned a non-JSON response (${response.status}).`,
      response.status,
    );
  }
}

function graphMessage(body: unknown, status: number): string {
  const error = (body as GraphErrorBody)?.error;
  return stripSecrets(
    error?.error_user_msg?.trim() || error?.message?.trim() || `Instagram API request failed (${status}).`,
  );
}

function asPermissionList(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export async function customerInstagramGet<T>(
  path: string,
  token: string,
  query: Record<string, string | undefined> = {},
): Promise<T> {
  return instagramGet<T>(path, token, query);
}

export async function exchangeCustomerAuthorizationCode(input: {
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; userId: string; permissions: string[]; expiresIn: number }> {
  const url = new URL(`${FACEBOOK_GRAPH_HOST}/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("client_secret", metaAppSecret());
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code", input.code.replace(/#_$/, "").split("#")[0]);
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const body = (await readJson(response)) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!response.ok || !body.access_token) {
    throw new InstagramApiError(
      graphMessage(body, response.status) || "Meta did not exchange the authorization code.",
      response.status,
    );
  }
  let accessToken = body.access_token;
  let expiresIn = Number(body.expires_in ?? 0);
  try {
    const longLived = await refreshCustomerToken(accessToken);
    if (longLived?.accessToken) {
      accessToken = longLived.accessToken;
      if (longLived.expiresIn > 0) expiresIn = longLived.expiresIn;
    }
  } catch {
    /* Unified Login system-user tokens may already be long-lived */
  }
  let permissions: string[] = [];
  try {
    const debugUrl = new URL(`${FACEBOOK_GRAPH_HOST}/${FACEBOOK_GRAPH_VERSION}/debug_token`);
    debugUrl.searchParams.set("input_token", accessToken);
    debugUrl.searchParams.set("access_token", `${metaAppId()}|${metaAppSecret()}`);
    const debugResponse = await fetch(debugUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const debugBody = (await readJson(debugResponse)) as {
      data?: { scopes?: string[] };
    };
    permissions = asPermissionList(debugBody.data?.scopes);
  } catch {
    permissions = [...CUSTOMER_UNIFIED_PERMISSIONS];
  }
  return { accessToken, userId: "", permissions, expiresIn };
}

export async function refreshCustomerToken(
  token: string,
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const url = new URL(`${FACEBOOK_GRAPH_HOST}/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("client_secret", metaAppSecret());
  url.searchParams.set("fb_exchange_token", token);
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const body = (await readJson(response)) as { access_token?: string; expires_in?: number };
  if (!response.ok || !body.access_token) return null;
  return { accessToken: body.access_token, expiresIn: Number(body.expires_in ?? 0) };
}

export async function fetchCustomerGraphProfile(
  token: string,
  igUserId: string,
): Promise<{
  userId: string;
  username: string;
  name: string;
  biography: string;
  website: string;
  profilePictureUrl: string;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
  accountType: string;
}> {
  let fields = igUserProfileFields(["biography", "website", "followers_count", "follows_count", "media_count", "profile_picture_url"]);
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const live = await instagramGet<Record<string, unknown>>(`/${igUserId}`, token, { fields });
      return {
        userId: String(live.id || igUserId),
        username: String(live.username || ""),
        name: String(live.name || ""),
        biography: String(live.biography || ""),
        website: String(live.website || ""),
        profilePictureUrl: String(live.profile_picture_url || ""),
        followersCount: numberOrNull(live.followers_count),
        followsCount: numberOrNull(live.follows_count),
        mediaCount: numberOrNull(live.media_count),
        accountType: "",
      };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const badField = nonexistingFieldFromGraphError(message);
      if (!badField) break;
      const next = withoutGraphField(fields, badField);
      if (!next || next === fields) break;
      fields = next;
    }
  }
  throw lastError instanceof Error ? lastError : new InstagramApiError("Instagram did not return a professional profile.");
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function customerGraphPublicError(error: unknown, fallback: string): string {
  return publicInstagramError(error, fallback);
}
