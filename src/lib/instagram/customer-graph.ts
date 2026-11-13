import "server-only";

import { InstagramApiError, publicInstagramError } from "./meta";
import {
  INSTAGRAM_GRAPH_HOST,
  INSTAGRAM_TOKEN_HOST,
  instagramGraphUrl,
} from "./customer-oauth";
import { metaAppId, metaAppSecret } from "./config";

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

export async function customerInstagramGet<T>(
  path: string,
  token: string,
  query: Record<string, string | undefined> = {},
): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : instagramGraphUrl(path));
  for (const [key, value] of Object.entries(query)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    cache: "no-store",
  });
  const body = await readJson(response);
  if (!response.ok) {
    const error = (body as GraphErrorBody).error;
    throw new InstagramApiError(
      stripSecrets(error?.error_user_msg || error?.message || `Instagram request failed (${response.status}).`),
      response.status,
      error?.code,
    );
  }
  return body as T;
}

export async function exchangeCustomerAuthorizationCode(input: {
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; userId: string; permissions: string[]; expiresIn: number }> {
  const body = new URLSearchParams({
    client_id: metaAppId(),
    client_secret: metaAppSecret(),
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
    code: input.code,
  });
  const response = await fetch(`${INSTAGRAM_TOKEN_HOST}/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
    cache: "no-store",
  });
  const json = (await readJson(response)) as {
    access_token?: string;
    user_id?: string | number;
    permissions?: string[];
    error_message?: string;
    error_type?: string;
  };
  if (!response.ok || !json.access_token) {
    throw new InstagramApiError(
      stripSecrets(json.error_message || "Instagram did not return an access token."),
      response.status || 502,
    );
  }
  let accessToken = json.access_token;
  let expiresIn = 60 * 60;
  try {
    const longLived = await customerInstagramGet<{ access_token?: string; expires_in?: number }>(
      `${INSTAGRAM_GRAPH_HOST}/access_token`,
      accessToken,
      {
        grant_type: "ig_exchange_token",
        client_secret: metaAppSecret(),
        access_token: accessToken,
      },
    );
    if (longLived.access_token) {
      accessToken = longLived.access_token;
      expiresIn = longLived.expires_in ?? 60 * 60 * 24 * 60;
    }
  } catch {
    /* keep the short-lived token if the long-lived exchange is unavailable */
  }
  return {
    accessToken,
    userId: String(json.user_id ?? ""),
    permissions: Array.isArray(json.permissions) ? json.permissions.map(String) : [],
    expiresIn,
  };
}

export async function refreshCustomerToken(token: string): Promise<{ accessToken: string; expiresIn: number } | null> {
  try {
    const body = await customerInstagramGet<{ access_token?: string; expires_in?: number }>(
      `${INSTAGRAM_GRAPH_HOST}/refresh_access_token`,
      token,
      { grant_type: "ig_refresh_token", access_token: token },
    );
    if (!body.access_token) return null;
    return { accessToken: body.access_token, expiresIn: body.expires_in ?? 60 * 60 * 24 * 60 };
  } catch {
    return null;
  }
}

export function customerGraphPublicError(error: unknown, fallback: string): string {
  return publicInstagramError(error, fallback);
}
