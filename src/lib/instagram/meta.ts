import "server-only";

import {
  FACEBOOK_GRAPH_HOST,
  FACEBOOK_GRAPH_VERSION,
  UNIFIED_PERMISSIONS,
  graphUrl,
  metaAppId,
  metaAppSecret,
  metaConfigurationId,
} from "./config";
import {
  collectDiscoveredInstagramAccounts,
  igUserProfileFields,
  readIgUserProfile,
} from "./discovery";
import { buildAuthorizationUrl, type InstagramAccount } from "./oauth";

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
    .replace(/app_secret=[^&\s]+/gi, "app_secret=[redacted]")
    .replace(/config_id=[^&\s]+/gi, "config_id=[redacted]");
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
  return buildAuthorizationUrl({
    clientId: metaAppId(),
    configId: metaConfigurationId(),
    redirectUri: input.redirectUri,
    state: input.state,
  });
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

export async function exchangeAuthorizationCode(input: {
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; expiresIn: number; permissions: string[] }> {
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
  const shortLived = body.access_token;
  let accessToken = shortLived;
  let expiresIn = Number(body.expires_in ?? 0);
  try {
    const longLived = await exchangeLongLivedToken(shortLived);
    accessToken = longLived.accessToken;
    if (longLived.expiresIn > 0) expiresIn = longLived.expiresIn;
  } catch {
    // System-user tokens from Unified Login may already be long-lived.
  }
  let permissions: string[] = [];
  try {
    const debug = await debugAccessToken(accessToken);
    permissions = debug.scopes;
  } catch {
    permissions = [...UNIFIED_PERMISSIONS];
  }
  return { accessToken, expiresIn, permissions };
}

async function exchangeLongLivedToken(
  shortLived: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(`${FACEBOOK_GRAPH_HOST}/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("client_secret", metaAppSecret());
  url.searchParams.set("fb_exchange_token", shortLived);
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const body = (await readJson(response)) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!response.ok || !body.access_token) {
    throw new InstagramApiError(
      graphMessage(body, response.status) || "Meta did not return a long-lived token.",
      response.status,
    );
  }
  return { accessToken: body.access_token, expiresIn: Number(body.expires_in ?? 0) };
}

export async function debugAccessToken(token: string): Promise<{
  scopes: string[];
  expiresAt: number | null;
  isValid: boolean;
}> {
  const url = new URL(`${FACEBOOK_GRAPH_HOST}/${FACEBOOK_GRAPH_VERSION}/debug_token`);
  url.searchParams.set("input_token", token);
  url.searchParams.set("access_token", `${metaAppId()}|${metaAppSecret()}`);
  const response = await fetch(url, { method: "GET", headers: { accept: "application/json" }, cache: "no-store" });
  const body = (await readJson(response)) as {
    data?: { scopes?: string[]; expires_at?: number; is_valid?: boolean };
  };
  if (!response.ok) {
    throw new InstagramApiError(graphMessage(body, response.status), response.status);
  }
  const expiresAt = Number(body.data?.expires_at ?? 0);
  return {
    scopes: asPermissionList(body.data?.scopes),
    expiresAt: expiresAt > 0 ? expiresAt : null,
    isValid: body.data?.is_valid !== false,
  };
}

export async function listGrantedPermissions(token: string): Promise<string[]> {
  try {
    const body = await instagramGet<{ data?: Array<{ permission?: string; status?: string }> }>(
      "/me/permissions",
      token,
    );
    return (body.data ?? [])
      .filter((row) => row.status === "granted" && row.permission)
      .map((row) => String(row.permission));
  } catch {
    return [];
  }
}

export type { InstagramAccount };

async function paginateGraph<T>(
  token: string,
  path: string,
  fields: string,
  read: (row: T) => void,
) {
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const body = await instagramGet<{
      data?: T[];
      paging?: { cursors?: { after?: string } };
    }>(path, token, { fields, after });
    for (const row of body.data ?? []) read(row);
    const next = body.paging?.cursors?.after;
    if (!body.data?.length || !next || next === after) break;
    after = next;
  }
}

export async function listAssignedInstagramAccounts(token: string): Promise<InstagramAccount[]> {
  const accounts: InstagramAccount[] = [];
  await paginateGraph<{ id?: string; username?: string }>(
    token,
    "/me/assigned_instagram_accounts",
    "id,username",
    (row) => {
      if (row.id) accounts.push({ id: String(row.id), username: row.username?.trim() || "" });
    },
  );
  return accounts;
}

export async function listPageInstagramAccounts(token: string): Promise<
  Array<{ id?: string; instagram_business_account?: { id?: string; username?: string } }>
> {
  const pages: Array<{
    id?: string;
    instagram_business_account?: { id?: string; username?: string };
  }> = [];
  await paginateGraph<{
    id?: string;
    instagram_business_account?: { id?: string; username?: string };
  }>(token, "/me/accounts", "id,name,instagram_business_account{id,username}", (row) => {
    pages.push(row);
  });
  return pages;
}

export async function listAvailableInstagramAccounts(token: string): Promise<InstagramAccount[]> {
  let assigned: InstagramAccount[] = [];
  let pages: Array<{ id?: string; instagram_business_account?: { id?: string; username?: string } }> =
    [];
  let me: {
    id?: string;
    client_business_id?: string;
    instagram_business_account?: { id?: string; username?: string };
  } | null = null;
  try {
    assigned = await listAssignedInstagramAccounts(token);
  } catch {
    // Facebook user tokens may expose Pages instead of assigned accounts.
  }
  try {
    pages = await listPageInstagramAccounts(token);
  } catch {
    // Business Integration System User tokens often have no /me/accounts.
  }
  try {
    me = await instagramGet<{
      id?: string;
      client_business_id?: string;
      instagram_business_account?: { id?: string; username?: string };
    }>("/me", token, {
      fields: "id,client_business_id,instagram_business_account{id,username}",
    });
  } catch {
    // /me is the system user or Facebook user, not an Instagram professional account.
  }
  const accounts = collectDiscoveredInstagramAccounts({ assigned, pages, me });
  for (const account of accounts) {
    if (account.username) continue;
    try {
      const profile = await fetchInstagramProfile(token, account.id);
      account.username = profile.username;
    } catch {
      // Keep the Graph IG User id; Agency Settings will show whatever Meta returned.
    }
  }
  return accounts;
}

export { selectAgencyAccount } from "./oauth";

export type InstagramProfile = {
  id: string;
  userId: string;
  username: string;
  accountType: string;
  name: string;
};

export async function fetchInstagramProfile(token: string, igUserId: string): Promise<InstagramProfile> {
  const profile = await readIgUserProfile({
    igUserId,
    fields: igUserProfileFields(),
    get: async (path, fields) =>
      instagramGet<Record<string, unknown>>(path, token, { fields }),
  });
  if (!profile.id) throw new InstagramApiError("Instagram did not return a professional account id.");
  return {
    id: profile.id,
    userId: profile.id,
    username: profile.username,
    accountType: "",
    name: profile.name,
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
