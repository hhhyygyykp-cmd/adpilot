import "server-only";

import {
  INSTAGRAM_AUTHORIZE_URL,
  INSTAGRAM_GRAPH_HOST,
  INSTAGRAM_SCOPES,
  INSTAGRAM_SHORT_LIVED_TOKEN_URL,
  graphUrl,
  metaAppId,
  metaAppSecret,
} from "./config";

export class InstagramApiError extends Error {
  status: number;
  code?: number;
  constructor(message: string, status = 502, code?: number) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type GraphErrorBody = {
  error?: { message?: string; type?: string; code?: number; error_user_msg?: string };
};

function stripSecrets(text: string): string {
  return text
    .replace(/access_token=[^&\s]+/gi, "access_token=[redacted]")
    .replace(/client_secret=[^&\s]+/gi, "client_secret=[redacted]")
    .replace(/app_secret=[^&\s]+/gi, "app_secret=[redacted]");
}

export function publicInstagramError(error: unknown, fallback = "Instagram request failed"): string {
  if (error instanceof InstagramApiError) return stripSecrets(error.message);
  if (error instanceof Error) return stripSecrets(error.message) || fallback;
  return fallback;
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
  const message =
    error?.error_user_msg?.trim() ||
    error?.message?.trim() ||
    `Instagram API request failed (${status}).`;
  return stripSecrets(message);
}

export async function instagramGet<T>(
  path: string,
  token: string,
  query: Record<string, string | undefined> = {},
): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : graphUrl(path));
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
    throw new InstagramApiError(
      graphMessage(body, response.status),
      response.status,
      (body as GraphErrorBody)?.error?.code,
    );
  }
  return body as T;
}

export async function instagramPost<T>(
  path: string,
  token: string,
  body: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : graphUrl(path));
  const payload = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) payload.set(key, value);
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: payload,
    cache: "no-store",
  });
  const json = await readJson(response);
  if (!response.ok) {
    throw new InstagramApiError(
      graphMessage(json, response.status),
      response.status,
      (json as GraphErrorBody)?.error?.code,
    );
  }
  return json as T;
}

export function authorizationUrl(input: { redirectUri: string; state: string }): string {
  const url = new URL(INSTAGRAM_AUTHORIZE_URL);
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
  url.searchParams.set("state", input.state);
  url.searchParams.set("force_authentication", "1");
  return url.toString();
}

type ShortLivedResponse =
  | {
      access_token?: string;
      user_id?: string | number;
      permissions?: string[] | string;
      data?: Array<{
        access_token?: string;
        user_id?: string | number;
        permissions?: string[] | string;
      }>;
    }
  | { error_type?: string; code?: number; error_message?: string };

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

export async function exchangeAuthorizationCode(input: {
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; userId: string; permissions: string[] }> {
  const payload = new URLSearchParams({
    client_id: metaAppId(),
    client_secret: metaAppSecret(),
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
    code: input.code.replace(/#_$/, "").split("#")[0],
  });
  const response = await fetch(INSTAGRAM_SHORT_LIVED_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: payload,
    cache: "no-store",
  });
  const body = (await readJson(response)) as ShortLivedResponse;
  if (!response.ok) {
    const message =
      ("error_message" in body && body.error_message) ||
      graphMessage(body, response.status) ||
      "Instagram did not exchange the authorization code.";
    throw new InstagramApiError(stripSecrets(message), response.status);
  }
  const row = "data" in body && Array.isArray(body.data) ? body.data[0] : body;
  const accessToken = row && "access_token" in row ? row.access_token : undefined;
  const userId = row && "user_id" in row ? String(row.user_id ?? "") : "";
  if (!accessToken) {
    throw new InstagramApiError("Instagram did not return an access token.");
  }
  return {
    accessToken,
    userId,
    permissions: asPermissionList(row && "permissions" in row ? row.permissions : undefined),
  };
}

async function tokenGet(url: string): Promise<{ access_token?: string; expires_in?: number }> {
  const response = await fetch(url, { method: "GET", headers: { accept: "application/json" }, cache: "no-store" });
  const body = await readJson(response);
  if (!response.ok) {
    throw new InstagramApiError(graphMessage(body, response.status), response.status);
  }
  return body as { access_token?: string; expires_in?: number };
}

export async function exchangeLongLivedToken(shortLivedToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const url = new URL(`${INSTAGRAM_GRAPH_HOST}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", metaAppSecret());
  url.searchParams.set("access_token", shortLivedToken);
  const body = await tokenGet(url.toString());
  if (!body.access_token) {
    throw new InstagramApiError("Instagram did not return a long-lived access token.");
  }
  return { accessToken: body.access_token, expiresIn: Number(body.expires_in ?? 0) };
}

export async function refreshLongLivedToken(token: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const url = new URL(`${INSTAGRAM_GRAPH_HOST}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);
  const body = await tokenGet(url.toString());
  if (!body.access_token) {
    throw new InstagramApiError("Instagram did not refresh the access token.");
  }
  return { accessToken: body.access_token, expiresIn: Number(body.expires_in ?? 0) };
}

export type InstagramProfile = {
  id: string;
  userId: string;
  username: string;
  accountType: string;
  name: string;
};

export async function fetchInstagramProfile(token: string): Promise<InstagramProfile> {
  const body = await instagramGet<{
    id?: string;
    user_id?: string;
    username?: string;
    account_type?: string;
    name?: string;
  }>("/me", token, {
    fields: "id,user_id,username,account_type,name",
  });
  const id = String(body.id || body.user_id || "");
  if (!id) throw new InstagramApiError("Instagram did not return a professional account id.");
  return {
    id,
    userId: String(body.user_id || body.id || id),
    username: body.username?.trim() || "",
    accountType: body.account_type?.trim() || "",
    name: body.name?.trim() || "",
  };
}

export async function createImageContainer(input: {
  igUserId: string;
  token: string;
  imageUrl: string;
  caption: string;
}): Promise<string> {
  const body = await instagramPost<{ id?: string }>(`/${input.igUserId}/media`, input.token, {
    image_url: input.imageUrl,
    caption: input.caption,
  });
  if (!body.id) throw new InstagramApiError("Instagram did not return a media container id.");
  return body.id;
}

export async function createReelContainer(input: {
  igUserId: string;
  token: string;
  videoUrl: string;
  caption: string;
}): Promise<string> {
  const body = await instagramPost<{ id?: string }>(`/${input.igUserId}/media`, input.token, {
    media_type: "REELS",
    video_url: input.videoUrl,
    caption: input.caption,
    share_to_feed: "true",
  });
  if (!body.id) throw new InstagramApiError("Instagram did not return a Reels container id.");
  return body.id;
}

export async function waitForContainer(input: {
  containerId: string;
  token: string;
  timeoutMs?: number;
}): Promise<void> {
  const deadline = Date.now() + (input.timeoutMs ?? 120_000);
  let delay = 2000;
  while (Date.now() < deadline) {
    const status = await instagramGet<{ status_code?: string; status?: string }>(
      `/${input.containerId}`,
      input.token,
      { fields: "status_code,status" },
    );
    const code = (status.status_code || status.status || "").toUpperCase();
    if (code === "FINISHED" || code === "PUBLISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new InstagramApiError("Instagram failed while processing the media container.");
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay + 1000, 8000);
  }
  throw new InstagramApiError("Instagram is still processing the media container.");
}

export async function publishContainer(input: {
  igUserId: string;
  token: string;
  creationId: string;
}): Promise<string> {
  const body = await instagramPost<{ id?: string }>(`/${input.igUserId}/media_publish`, input.token, {
    creation_id: input.creationId,
  });
  if (!body.id) throw new InstagramApiError("Instagram did not return a published media id.");
  return body.id;
}

export async function fetchPublishedMedia(input: {
  mediaId: string;
  token: string;
}): Promise<{
  id: string;
  permalink?: string;
  timestamp?: string;
  mediaType?: string;
  likeCount?: number;
  commentsCount?: number;
}> {
  const body = await instagramGet<{
    id?: string;
    permalink?: string;
    timestamp?: string;
    media_type?: string;
    like_count?: number;
    comments_count?: number;
  }>(`/${input.mediaId}`, input.token, {
    fields: "id,permalink,timestamp,media_type,like_count,comments_count",
  });
  return {
    id: String(body.id || input.mediaId),
    permalink: body.permalink,
    timestamp: body.timestamp,
    mediaType: body.media_type,
    likeCount: typeof body.like_count === "number" ? body.like_count : undefined,
    commentsCount: typeof body.comments_count === "number" ? body.comments_count : undefined,
  };
}

export async function fetchMediaInsights(input: {
  mediaId: string;
  token: string;
  metrics: string[];
}): Promise<Record<string, number>> {
  const body = await instagramGet<{
    data?: Array<{ name?: string; values?: Array<{ value?: number }> }>;
  }>(`/${input.mediaId}/insights`, input.token, {
    metric: input.metrics.join(","),
  });
  const out: Record<string, number> = {};
  for (const row of body.data ?? []) {
    const name = row.name?.trim();
    const value = row.values?.[0]?.value;
    if (!name || typeof value !== "number" || Number.isNaN(value)) continue;
    out[name] = value;
  }
  return out;
}
