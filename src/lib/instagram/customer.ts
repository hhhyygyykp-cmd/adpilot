import "server-only";

import { decryptSecret, encryptSecret, newId, randomToken } from "../crypto";
import { parseJson, sql } from "../db";
import { audit } from "../audit";
import { getBusiness, updateBusiness } from "../queries/businesses";
import { deleteMemoryByKind, insertMemory } from "../queries/memory";
import type { Business } from "../types";
import { metaAppId, metaAppSecret, metaConfigured, missingMetaSecrets } from "./config";
import {
  CUSTOMER_INSTAGRAM_PERMISSIONS,
  buildCustomerAuthorizationUrl,
  customerInstagramRedirectUri,
  customerPermissionsSafe,
} from "./customer-oauth";
import {
  customerGraphPublicError,
  customerInstagramGet,
  exchangeCustomerAuthorizationCode,
  refreshCustomerToken,
} from "./customer-graph";

export type CustomerInstagramStatus =
  | "disconnected"
  | "connected"
  | "expired"
  | "needs_reauth"
  | "ineligible"
  | "not_configured";

export type CustomerInstagramPublic = {
  status: CustomerInstagramStatus;
  username: string | null;
  name: string | null;
  biography: string | null;
  website: string | null;
  followersCount: number | null;
  mediaCount: number | null;
  accountType: string | null;
  permissions: string[];
  lastError: string;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  canPublish: false;
  login: "instagram";
  accessNote: string;
  appReviewNote: string;
};

export type RetrievedPost = {
  id: string;
  mediaType: string;
  caption: string;
  postedAt: string | null;
  likeCount: number | null;
  commentsCount: number | null;
  permalink: string | null;
};

export type InferredInsights = {
  overview: string;
  productsServices: string;
  brandPersonality: string;
  visualIdentity: string;
  contentThemes: string;
  audience: string;
  opportunities: string;
  recommendedApproaches: string;
  confidence: "low" | "medium" | "high";
  preliminary: boolean;
  visionUsed: boolean;
};

export type CustomerAnalysisPublic = {
  id: string | null;
  status: string;
  retrieved: {
    profile: Record<string, unknown>;
    posting: Record<string, unknown>;
    insights: { available: boolean; note: string };
    posts: RetrievedPost[];
  } | null;
  inferred: InferredInsights | null;
  visionUsed: boolean;
  mediaCount: number;
  retrievedAt: string | null;
  confirmedAt: string | null;
  lastError: string;
};

type AccountRow = {
  id: string;
  customer_id: string;
  business_id: string;
  ig_user_id: string | null;
  username: string | null;
  name: string | null;
  biography: string | null;
  website: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  follows_count: number | null;
  media_count: number | null;
  account_type: string | null;
  permissions: unknown;
  token_ciphertext: string | null;
  token_expires_at: string | null;
  status: CustomerInstagramStatus;
  last_error: string;
  connected_at: string | null;
  last_synced_at: string | null;
};

const ACCESS_NOTE =
  "AdPilot reads your public professional profile, posts, captions, and available insights to understand your brand. It never posts from your account.";

const APP_REVIEW_NOTE =
  "Other customers’ Instagram accounts need Meta App Review. Until then, only tester accounts can connect. Insights may be missing until Meta approves that access.";

function permissionsOf(row: AccountRow | null): string[] {
  const raw = parseJson<string[]>(row?.permissions, []);
  return Array.isArray(raw) ? raw.map(String) : [];
}

function mapPublic(row: AccountRow | null): CustomerInstagramPublic {
  if (!metaConfigured()) {
    return {
      status: "not_configured",
      username: null,
      name: null,
      biography: null,
      website: null,
      followersCount: null,
      mediaCount: null,
      accountType: null,
      permissions: [],
      lastError: `Add these Cursor secrets, then connect Instagram: ${missingMetaSecrets().join(", ")}.`,
      connectedAt: null,
      lastSyncedAt: null,
      canPublish: false,
      login: "instagram",
      accessNote: ACCESS_NOTE,
      appReviewNote: APP_REVIEW_NOTE,
    };
  }
  return {
    status: row?.status ?? "disconnected",
    username: row?.username ?? null,
    name: row?.name ?? null,
    biography: row?.biography ?? null,
    website: row?.website ?? null,
    followersCount: row?.followers_count ?? null,
    mediaCount: row?.media_count ?? null,
    accountType: row?.account_type ?? null,
    permissions: permissionsOf(row),
    lastError: row?.last_error ?? "",
    connectedAt: row?.connected_at ? new Date(row.connected_at).toISOString() : null,
    lastSyncedAt: row?.last_synced_at ? new Date(row.last_synced_at).toISOString() : null,
    canPublish: false,
    login: "instagram",
    accessNote: ACCESS_NOTE,
    appReviewNote: APP_REVIEW_NOTE,
  };
}

async function loadAccount(customerId: string, businessId: string): Promise<AccountRow | null> {
  const rows = await sql<AccountRow>(
    `select * from customer_instagram_accounts where customer_id = $1 and business_id = $2 limit 1`,
    [customerId, businessId],
  );
  return rows[0] ?? null;
}

async function ensureAccount(customerId: string, businessId: string): Promise<AccountRow> {
  const existing = await loadAccount(customerId, businessId);
  if (existing) return existing;
  const id = newId();
  await sql(
    `insert into customer_instagram_accounts (id, customer_id, business_id, status)
     values ($1, $2, $3, 'disconnected')
     on conflict (business_id) do nothing`,
    [id, customerId, businessId],
  );
  const created = await loadAccount(customerId, businessId);
  if (!created) throw new Error("Could not start Instagram linking for this business.");
  return created;
}

export async function getCustomerInstagramPublic(
  customerId: string,
  businessId: string,
): Promise<CustomerInstagramPublic> {
  return mapPublic(await loadAccount(customerId, businessId));
}

export async function startCustomerInstagramOAuth(input: {
  customerId: string;
  businessId: string;
}): Promise<{ url: string } | { error: string; status: number }> {
  const business = await getBusiness(input.customerId, input.businessId);
  if (!business) return { error: "Business not found", status: 404 };
  if (!metaConfigured()) {
    return {
      error: `Add these Cursor secrets, then connect Instagram: ${missingMetaSecrets().join(", ")}.`,
      status: 409,
    };
  }
  await sql(`delete from customer_instagram_oauth_states where expires_at <= now()`);
  const state = randomToken(24);
  await sql(
    `insert into customer_instagram_oauth_states (id, state, customer_id, business_id, expires_at)
     values ($1, $2, $3, $4, $5)`,
    [newId(), state, input.customerId, input.businessId, new Date(Date.now() + 10 * 60 * 1000).toISOString()],
  );
  return {
    url: buildCustomerAuthorizationUrl({
      clientId: metaAppId(),
      redirectUri: customerInstagramRedirectUri(),
      state,
    }),
  };
}

export async function receiveCustomerInstagramCallback(input: {
  code: string | null;
  state: string | null;
  oauthError: string | null;
}): Promise<{ ok: true; state: string; businessId: string } | { error: string; status: number; businessId?: string }> {
  if (input.oauthError) {
    return { error: "Instagram authorization was not completed. You can still fill in your business profile by hand.", status: 400 };
  }
  if (!input.code || !input.state) {
    return { error: "Instagram did not return an authorization code.", status: 400 };
  }
  if (input.code.length > 2048 || input.state.length > 128) {
    return { error: "This Instagram connection link is invalid.", status: 400 };
  }
  const rows = await sql<{ state: string; business_id: string; authorization_code: string | null }>(
    `select state, business_id, authorization_code from customer_instagram_oauth_states
     where state = $1 and expires_at > now()`,
    [input.state],
  );
  const row = rows[0];
  if (!row) return { error: "This Instagram connection link expired. Start Connect Instagram again.", status: 400 };
  if (!row.authorization_code) {
    await sql(
      `update customer_instagram_oauth_states
       set authorization_code = $2
       where state = $1 and authorization_code is null`,
      [input.state, input.code],
    );
  }
  return { ok: true, state: row.state, businessId: row.business_id };
}

export async function completeCustomerInstagramOAuth(input: {
  customerId: string;
  businessId: string;
  state: string | null;
}): Promise<{ ok: true; username: string } | { error: string; status: number }> {
  const business = await getBusiness(input.customerId, input.businessId);
  if (!business) return { error: "Business not found", status: 404 };
  if (!input.state) return { error: "This Instagram connection link expired. Start Connect Instagram again.", status: 400 };
  const pending = await sql<{
    customer_id: string;
    business_id: string;
    authorization_code: string | null;
  }>(
    `select customer_id, business_id, authorization_code from customer_instagram_oauth_states
     where state = $1 and expires_at > now()`,
    [input.state],
  );
  const expected = pending[0];
  if (!expected) return { error: "This Instagram connection link expired. Start Connect Instagram again.", status: 400 };
  if (expected.customer_id !== input.customerId || expected.business_id !== input.businessId) {
    return { error: "Sign in as the same customer who started Connect Instagram.", status: 403 };
  }
  if (!expected.authorization_code) {
    return { error: "Finish Instagram login, then return to AdPilot.", status: 400 };
  }
  const consumed = await sql<{ authorization_code: string }>(
    `delete from customer_instagram_oauth_states
     where state = $1 and customer_id = $2 and business_id = $3 and authorization_code is not null
     returning authorization_code`,
    [input.state, input.customerId, input.businessId],
  );
  const code = consumed[0]?.authorization_code;
  if (!code) return { error: "This Instagram connection link expired. Start Connect Instagram again.", status: 400 };
  try {
    const exchanged = await exchangeCustomerAuthorizationCode({
      code,
      redirectUri: customerInstagramRedirectUri(),
    });
    if (!customerPermissionsSafe(exchanged.permissions)) {
      return { error: "This connection asked for posting access. AdPilot refused it. Connect again for reading only.", status: 403 };
    }
    const saved = await storeCustomerConnection({
      customerId: input.customerId,
      businessId: input.businessId,
      token: exchanged.accessToken,
      expiresIn: exchanged.expiresIn,
      permissions: exchanged.permissions.length ? exchanged.permissions : [...CUSTOMER_INSTAGRAM_PERMISSIONS],
      fallbackUserId: exchanged.userId,
    });
    return { ok: true, username: saved.username };
  } catch (error) {
    const message = customerGraphPublicError(
      error,
      "Instagram could not connect this account. Professional accounts are required. You can still fill in your business profile by hand.",
    );
    const row = await ensureAccount(input.customerId, input.businessId);
    await sql(
      `update customer_instagram_accounts
       set last_error = $3, status = 'ineligible', updated_at = now()
       where id = $1 and customer_id = $2`,
      [row.id, input.customerId, message],
    );
    return { error: message, status: 502 };
  }
}

async function storeCustomerConnection(input: {
  customerId: string;
  businessId: string;
  token: string;
  expiresIn: number;
  permissions: string[];
  fallbackUserId: string;
}): Promise<{ username: string }> {
  const profile = await fetchCustomerProfile(input.token);
  const username = profile.username || "";
  if (!username) {
    throw new Error("Instagram did not return a username. Connect a professional account.");
  }
  const ciphertext = encryptSecret(input.token, metaAppSecret());
  const expiresAt =
    input.expiresIn > 0 ? new Date(Date.now() + input.expiresIn * 1000).toISOString() : null;
  const row = await ensureAccount(input.customerId, input.businessId);
  await sql(
    `update customer_instagram_accounts set
       ig_user_id = $3,
       username = $4,
       name = $5,
       biography = $6,
       website = $7,
       profile_picture_url = $8,
       followers_count = $9,
       follows_count = $10,
       media_count = $11,
       account_type = $12,
       permissions = $13::jsonb,
       token_ciphertext = $14,
       token_expires_at = $15,
       status = 'connected',
       last_error = '',
       connected_at = now(),
       last_synced_at = now(),
       imported_deleted_at = null,
       updated_at = now()
     where id = $1 and customer_id = $2`,
    [
      row.id,
      input.customerId,
      profile.userId || input.fallbackUserId,
      username,
      profile.name,
      profile.biography,
      profile.website,
      profile.profilePictureUrl,
      profile.followersCount,
      profile.followsCount,
      profile.mediaCount,
      profile.accountType,
      JSON.stringify(input.permissions.filter((item) => !item.includes("publish"))),
      ciphertext,
      expiresAt,
    ],
  );
  await audit({
    actorCustomerId: input.customerId,
    action: "instagram.customer.connect",
    entityType: "customer_instagram_account",
    entityId: row.id,
    metadata: { businessId: input.businessId, username, publish: false },
  });
  return { username };
}

type Profile = {
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
};

async function fetchCustomerProfile(token: string): Promise<Profile> {
  const fields = [
    "user_id",
    "id",
    "username",
    "name",
    "account_type",
    "biography",
    "website",
    "profile_picture_url",
    "followers_count",
    "follows_count",
    "media_count",
  ].join(",");
  const live = await customerInstagramGet<Record<string, unknown>>("/me", token, { fields });
  return {
    userId: String(live.user_id || live.id || ""),
    username: String(live.username || ""),
    name: String(live.name || ""),
    biography: String(live.biography || ""),
    website: String(live.website || ""),
    profilePictureUrl: String(live.profile_picture_url || ""),
    followersCount: numberOrNull(live.followers_count),
    followsCount: numberOrNull(live.follows_count),
    mediaCount: numberOrNull(live.media_count),
    accountType: String(live.account_type || ""),
  };
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

async function decryptCustomerToken(row: AccountRow): Promise<string | null> {
  if (!row.token_ciphertext) return null;
  try {
    return decryptSecret(row.token_ciphertext, metaAppSecret());
  } catch {
    return null;
  }
}

export async function disconnectCustomerInstagram(input: {
  customerId: string;
  businessId: string;
  deleteImported: boolean;
}): Promise<void> {
  const row = await loadAccount(input.customerId, input.businessId);
  if (!row) return;
  await sql(
    `update customer_instagram_accounts set
       ig_user_id = null,
       username = null,
       name = null,
       biography = null,
       website = null,
       profile_picture_url = null,
       followers_count = null,
       follows_count = null,
       media_count = null,
       account_type = null,
       permissions = '[]'::jsonb,
       token_ciphertext = null,
       token_expires_at = null,
       status = 'disconnected',
       last_error = '',
       imported_deleted_at = case when $3 then now() else imported_deleted_at end,
       updated_at = now()
     where id = $1 and customer_id = $2`,
    [row.id, input.customerId, input.deleteImported],
  );
  if (input.deleteImported) {
    await sql(`delete from customer_instagram_media where customer_id = $1 and business_id = $2`, [
      input.customerId,
      input.businessId,
    ]);
    await sql(`delete from customer_instagram_analyses where customer_id = $1 and business_id = $2`, [
      input.customerId,
      input.businessId,
    ]);
    await deleteMemoryByKind(input.customerId, input.businessId, "instagram_observation");
  }
  await audit({
    actorCustomerId: input.customerId,
    action: "instagram.customer.disconnect",
    entityType: "customer_instagram_account",
    entityId: row.id,
    metadata: { businessId: input.businessId, deleteImported: input.deleteImported },
  });
}

type MediaRow = {
  ig_media_id: string;
  media_type: string;
  media_product_type: string;
  caption: string;
  permalink: string | null;
  posted_at: string | null;
  like_count: number | null;
  comments_count: number | null;
  thumbnail_url: string | null;
  insights: unknown;
  insights_unavailable: string | null;
};

type GraphMediaItem = {
  id?: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  thumbnail_url?: string;
  media_url?: string;
};

async function syncMedia(input: { customerId: string; businessId: string; token: string; igUserId: string }) {
  const collected: GraphMediaItem[] = [];
  let path: string | undefined = `/${input.igUserId}/media`;
  let query: Record<string, string | undefined> = {
    fields:
      "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url",
    limit: "25",
  };
  let pages = 0;
  while (path && pages < 2 && collected.length < 40) {
    const page = (await customerInstagramGet(
      path,
      input.token,
      query,
    )) as { data?: GraphMediaItem[]; paging?: { next?: string } };
    collected.push(...(page.data ?? []));
    path = page.paging?.next;
    query = {};
    pages += 1;
  }
  await sql(`delete from customer_instagram_media where customer_id = $1 and business_id = $2`, [
    input.customerId,
    input.businessId,
  ]);
  for (const item of collected.slice(0, 40)) {
    if (!item.id) continue;
    let insightsUnavailable = "";
    let insights: unknown = null;
    try {
      const ig = await customerInstagramGet<{ data?: Array<{ name?: string; values?: Array<{ value?: unknown }> }> }>(
        `/${item.id}/insights`,
        input.token,
        { metric: "views,reach,saved,shares" },
      );
      insights = ig.data ?? [];
    } catch (error) {
      insightsUnavailable = customerGraphPublicError(error, "Insights were not available for this post.");
    }
    await sql(
      `insert into customer_instagram_media (
         id, customer_id, business_id, ig_media_id, media_type, media_product_type, caption, permalink,
         posted_at, like_count, comments_count, thumbnail_url, insights, insights_unavailable
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)`,
      [
        newId(),
        input.customerId,
        input.businessId,
        item.id,
        item.media_type ?? "",
        item.media_product_type ?? "",
        (item.caption ?? "").slice(0, 2200),
        item.permalink ?? null,
        item.timestamp ? new Date(item.timestamp).toISOString() : null,
        numberOrNull(item.like_count),
        numberOrNull(item.comments_count),
        item.thumbnail_url || item.media_url || null,
        JSON.stringify(insights ?? []),
        insightsUnavailable,
      ],
    );
  }
}

export async function analyzeCustomerInstagram(input: {
  customerId: string;
  businessId: string;
}): Promise<{ analysis: CustomerAnalysisPublic } | { error: string; status: number }> {
  const business = await getBusiness(input.customerId, input.businessId);
  if (!business) return { error: "Business not found", status: 404 };
  const row = await loadAccount(input.customerId, input.businessId);
  if (!row || row.status !== "connected") {
    return { error: "Connect Instagram first, then analyze.", status: 409 };
  }
  const token = await decryptCustomerToken(row);
  if (!token) return { error: "Instagram access expired. Connect again.", status: 409 };
  const refreshed = await refreshCustomerToken(token);
  const liveToken = refreshed?.accessToken || token;
  if (refreshed?.accessToken) {
    await sql(
      `update customer_instagram_accounts
       set token_ciphertext = $3, token_expires_at = $4, updated_at = now()
       where id = $1 and customer_id = $2`,
      [
        row.id,
        input.customerId,
        encryptSecret(refreshed.accessToken, metaAppSecret()),
        new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
      ],
    );
  }
  try {
    const profile = await fetchCustomerProfile(liveToken);
    const igUserId = profile.userId || row.ig_user_id || "";
    if (igUserId) {
      await syncMedia({
        customerId: input.customerId,
        businessId: input.businessId,
        token: liveToken,
        igUserId,
      });
    }
    await sql(
      `update customer_instagram_accounts set
         username = $3, name = $4, biography = $5, website = $6, profile_picture_url = $7,
         followers_count = $8, follows_count = $9, media_count = $10, account_type = $11,
         last_synced_at = now(), last_error = '', updated_at = now()
       where id = $1 and customer_id = $2`,
      [
        row.id,
        input.customerId,
        profile.username,
        profile.name,
        profile.biography,
        profile.website,
        profile.profilePictureUrl,
        profile.followersCount,
        profile.followsCount,
        profile.mediaCount,
        profile.accountType,
      ],
    );
    const media = await sql<MediaRow>(
      `select ig_media_id, media_type, media_product_type, caption, permalink, posted_at, like_count, comments_count, thumbnail_url, insights, insights_unavailable
       from customer_instagram_media
       where customer_id = $1 and business_id = $2
       order by posted_at desc nulls last
       limit 40`,
      [input.customerId, input.businessId],
    );
    const visionUrls = media
      .map((item) => item.thumbnail_url)
      .filter((url): url is string => Boolean(url))
      .slice(0, 4);
    const inferred = await inferBusiness(business, profile, media, visionUrls);
    const retrieved = {
      profile: {
        username: profile.username,
        name: profile.name,
        biography: profile.biography,
        website: profile.website,
        followersCount: profile.followersCount,
        mediaCount: profile.mediaCount,
        accountType: profile.accountType,
        source: "Instagram professional profile",
        retrievedAt: new Date().toISOString(),
      },
      posting: postingSummary(media),
      insights: insightsNote(media),
      posts: media.map(toPublicPost),
    };
    const id = newId();
    await sql(
      `insert into customer_instagram_analyses (
         id, customer_id, business_id, status, retrieved, inferred, vision_used, media_count, retrieved_at, updated_at
       ) values ($1,$2,$3,'pending_review',$4::jsonb,$5::jsonb,$6,$7,now(),now())`,
      [
        id,
        input.customerId,
        input.businessId,
        JSON.stringify(retrieved),
        JSON.stringify(inferred),
        inferred.visionUsed,
        media.length,
      ],
    );
    await audit({
      actorCustomerId: input.customerId,
      action: "instagram.customer.analyze",
      entityType: "customer_instagram_analysis",
      entityId: id,
      metadata: { businessId: input.businessId, mediaCount: media.length, visionUsed: inferred.visionUsed },
    });
    return { analysis: await getLatestAnalysis(input.customerId, input.businessId) };
  } catch (error) {
    const message = customerGraphPublicError(
      error,
      "AdPilot could not read this Instagram account. Professional accounts are required.",
    );
    await sql(
      `update customer_instagram_accounts set last_error = $3, updated_at = now() where id = $1 and customer_id = $2`,
      [row.id, input.customerId, message],
    );
    return { error: message, status: 502 };
  }
}

function toPublicPost(row: MediaRow): RetrievedPost {
  return {
    id: row.ig_media_id,
    mediaType: row.media_product_type || row.media_type,
    caption: row.caption,
    postedAt: row.posted_at ? new Date(row.posted_at).toISOString() : null,
    likeCount: row.like_count,
    commentsCount: row.comments_count,
    permalink: row.permalink,
  };
}

function postingSummary(media: MediaRow[]) {
  const types = new Map<string, number>();
  for (const item of media) {
    const key = (item.media_product_type || item.media_type || "unknown").toLowerCase();
    types.set(key, (types.get(key) ?? 0) + 1);
  }
  const dates = media
    .map((item) => (item.posted_at ? new Date(item.posted_at).getTime() : null))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  let frequency = "Not enough dated posts to estimate a posting rhythm.";
  if (dates.length >= 4) {
    const spanDays = Math.max(1, (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24));
    const perWeek = (dates.length / spanDays) * 7;
    frequency = `About ${perWeek.toFixed(1)} posts per week across the retrieved history.`;
  }
  return {
    count: media.length,
    formats: Object.fromEntries(types),
    frequency,
    source: "Retrieved Instagram media",
  };
}

function insightsNote(media: MediaRow[]) {
  const withInsights = media.filter((item) => {
    const data = parseJson<unknown[]>(item.insights, []);
    return Array.isArray(data) && data.length > 0;
  });
  if (withInsights.length === 0) {
    const reason = media.find((item) => item.insights_unavailable)?.insights_unavailable;
    return {
      available: false,
      note:
        reason ||
        "Post insights were not returned. Likes or views are not sales. Meta App Review is required before insights work for customers who are not testers.",
    };
  }
  return {
    available: true,
    note: `Insights were returned for ${withInsights.length} of ${media.length} retrieved posts. Engagement is not the same as sales or leads.`,
  };
}

async function inferBusiness(
  business: Business,
  profile: Profile,
  media: MediaRow[],
  visionUrls: string[],
): Promise<InferredInsights> {
  const captions = media.map((item) => item.caption).filter((text) => text.trim());
  const preliminary = media.length < 5;
  const heuristic = heuristicInsights(business, profile, media, preliminary);
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return { ...heuristic, visionUsed: false };
  try {
    const visionUsed = visionUrls.length > 0;
    const userParts: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: JSON.stringify({
          savedProfile: {
            name: business.name,
            category: business.category,
            description: business.description,
            productsServices: business.productsServices,
          },
          instagramProfile: profile,
          captions: captions.slice(0, 30),
          posting: postingSummary(media),
          instruction:
            "Distinguish retrieved Instagram information from inference. Do not invent prices, hours, or offers. Do not treat likes as sales. If vision images are present, you may comment on visual style; otherwise set visualIdentity from captions only and say you did not see the images. Return JSON with overview, productsServices, brandPersonality, visualIdentity, contentThemes, audience, opportunities, recommendedApproaches, confidence (low|medium|high), preliminary (boolean).",
        }),
      },
    ];
    for (const url of visionUrls) {
      userParts.push({ type: "image_url", image_url: { url } });
    }
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are AdPilot's business intelligence agent. Never claim you saw images unless image inputs are present. Never invent facts. Never copy captions as ad copy.",
          },
          { role: "user", content: userParts },
        ],
      }),
    });
    if (!response.ok) return { ...heuristic, visionUsed: false };
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = JSON.parse(body.choices?.[0]?.message?.content || "{}") as Partial<InferredInsights>;
    return {
      overview: String(parsed.overview || heuristic.overview),
      productsServices: String(parsed.productsServices || heuristic.productsServices),
      brandPersonality: String(parsed.brandPersonality || heuristic.brandPersonality),
      visualIdentity: visionUsed
        ? String(parsed.visualIdentity || heuristic.visualIdentity)
        : "Images were not visually analyzed. This note is from captions and profile text only.",
      contentThemes: String(parsed.contentThemes || heuristic.contentThemes),
      audience: String(parsed.audience || heuristic.audience),
      opportunities: String(parsed.opportunities || heuristic.opportunities),
      recommendedApproaches: String(parsed.recommendedApproaches || heuristic.recommendedApproaches),
      confidence: parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low",
      preliminary: Boolean(parsed.preliminary) || preliminary,
      visionUsed,
    };
  } catch {
    return { ...heuristic, visionUsed: false };
  }
}

function heuristicInsights(
  business: Business,
  profile: Profile,
  media: MediaRow[],
  preliminary: boolean,
): InferredInsights {
  const captions = media.map((item) => item.caption).filter(Boolean);
  const formats = postingSummary(media).formats as Record<string, number>;
  const formatLine = Object.entries(formats)
    .map(([key, count]) => `${key}: ${count}`)
    .join(", ");
  return {
    overview: [
      profile.name || business.name || profile.username,
      profile.biography || business.description,
    ]
      .filter(Boolean)
      .join(". "),
    productsServices:
      business.productsServices ||
      captions.slice(0, 3).join(" ") ||
      "Not enough retrieved captions to name products yet.",
    brandPersonality: profile.biography || business.brandPersonality || "Not enough text to describe tone yet.",
    visualIdentity: "Images were not visually analyzed. Connect and analyze again when vision is configured.",
    contentThemes: formatLine
      ? `Retrieved formats — ${formatLine}.`
      : "Not enough posts to describe themes.",
    audience: business.targetCustomers || "Audience is not stated in the retrieved profile.",
    opportunities: preliminary
      ? "Recommendations are preliminary because few posts were retrieved."
      : "Use the retrieved themes in new ads. Do not copy old captions.",
    recommendedApproaches:
      "Lead with what the business actually shows. Do not treat likes as sales. Create original ads from the confirmed profile.",
    confidence: preliminary ? "low" : "medium",
    preliminary,
    visionUsed: false,
  };
}

export async function getLatestAnalysis(
  customerId: string,
  businessId: string,
): Promise<CustomerAnalysisPublic> {
  const rows = await sql<{
    id: string;
    status: string;
    retrieved: unknown;
    inferred: unknown;
    vision_used: boolean;
    media_count: number;
    last_error: string;
    retrieved_at: string | null;
    confirmed_at: string | null;
  }>(
    `select id, status, retrieved, inferred, vision_used, media_count, last_error, retrieved_at, confirmed_at
     from customer_instagram_analyses
     where customer_id = $1 and business_id = $2
     order by created_at desc
     limit 1`,
    [customerId, businessId],
  );
  const row = rows[0];
  if (!row) {
    return {
      id: null,
      status: "none",
      retrieved: null,
      inferred: null,
      visionUsed: false,
      mediaCount: 0,
      retrievedAt: null,
      confirmedAt: null,
      lastError: "",
    };
  }
  const retrieved = parseJson<CustomerAnalysisPublic["retrieved"]>(row.retrieved, null);
  if (retrieved?.posts) {
    retrieved.posts = retrieved.posts.map((post) => ({
      ...post,
      caption: post.caption,
    }));
  }
  return {
    id: row.id,
    status: row.status,
    retrieved,
    inferred: parseJson<InferredInsights | null>(row.inferred, null),
    visionUsed: row.vision_used,
    mediaCount: row.media_count,
    retrievedAt: row.retrieved_at ? new Date(row.retrieved_at).toISOString() : null,
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
    lastError: row.last_error || "",
  };
}

export async function confirmCustomerAnalysis(input: {
  customerId: string;
  businessId: string;
  analysisId: string;
  inferred: Partial<InferredInsights>;
}): Promise<{ analysis: CustomerAnalysisPublic; business: Business | null } | { error: string; status: number }> {
  const business = await getBusiness(input.customerId, input.businessId);
  if (!business) return { error: "Business not found", status: 404 };
  const rows = await sql<{ id: string; inferred: unknown; retrieved: unknown; vision_used: boolean }>(
    `select id, inferred, retrieved, vision_used from customer_instagram_analyses
     where id = $1 and customer_id = $2 and business_id = $3 limit 1`,
    [input.analysisId, input.customerId, input.businessId],
  );
  const row = rows[0];
  if (!row) return { error: "Review the findings first.", status: 404 };
  const current = parseJson<InferredInsights>(row.inferred, heuristicInsights(business, {
    userId: "",
    username: "",
    name: "",
    biography: "",
    website: "",
    profilePictureUrl: "",
    followersCount: null,
    followsCount: null,
    mediaCount: null,
    accountType: "",
  }, [], true));
  const next: InferredInsights = {
    ...current,
    overview: input.inferred.overview?.trim() || current.overview,
    productsServices: input.inferred.productsServices?.trim() || current.productsServices,
    brandPersonality: input.inferred.brandPersonality?.trim() || current.brandPersonality,
    visualIdentity: input.inferred.visualIdentity?.trim() || current.visualIdentity,
    contentThemes: input.inferred.contentThemes?.trim() || current.contentThemes,
    audience: input.inferred.audience?.trim() || current.audience,
    opportunities: input.inferred.opportunities?.trim() || current.opportunities,
    recommendedApproaches: input.inferred.recommendedApproaches?.trim() || current.recommendedApproaches,
  };
  await sql(
    `update customer_instagram_analyses
     set inferred = $4::jsonb, status = 'confirmed', confirmed_at = now(), updated_at = now()
     where id = $1 and customer_id = $2 and business_id = $3`,
    [row.id, input.customerId, input.businessId, JSON.stringify(next)],
  );
  const retrieved = parseJson<{ profile?: { username?: string; retrievedAt?: string } }>(row.retrieved, {});
  const source = `Instagram @${retrieved.profile?.username || "account"}`;
  const retrievedAt = retrieved.profile?.retrievedAt || new Date().toISOString();
  await deleteMemoryByKind(input.customerId, input.businessId, "instagram_observation");
  const observations: Array<[string, string, string]> = [
    ["Business overview", next.overview, "Customer-approved Instagram analysis"],
    ["Products and services", next.productsServices, "Customer-approved Instagram analysis"],
    ["Brand personality", next.brandPersonality, "Customer-approved Instagram analysis"],
    ["Visual identity", next.visualIdentity, row.vision_used ? "Customer-approved visual analysis" : "Captions only — images were not seen"],
    ["Content themes", next.contentThemes, "Retrieved posting history"],
    ["Potential audience", next.audience, "Customer-approved Instagram analysis"],
    ["Marketing opportunities", next.opportunities, "Hypothesis until proven by campaign results"],
  ];
  for (const [label, value, evidence] of observations) {
    if (!value.trim()) continue;
    await insertMemory({
      customerId: input.customerId,
      businessId: input.businessId,
      sourceCampaignId: null,
      kind: label === "Marketing opportunities" ? "hypothesis" : "instagram_observation",
      label,
      value,
      evidence,
      source,
      confidence: next.preliminary ? "low" : next.confidence,
      retrievedAt,
    });
  }
  const patch: Partial<Business> = { onboardingComplete: true };
  if (!business.description.trim() && next.overview) patch.description = next.overview.slice(0, 2000);
  if (!business.productsServices.trim() && next.productsServices) {
    patch.productsServices = next.productsServices.slice(0, 2000);
  }
  if (!business.brandPersonality.trim() && next.brandPersonality) {
    patch.brandPersonality = next.brandPersonality.slice(0, 2000);
  }
  if (!business.targetCustomers.trim() && next.audience) patch.targetCustomers = next.audience.slice(0, 2000);
  if (!business.marketingGoals.trim() && next.recommendedApproaches) {
    patch.marketingGoals = next.recommendedApproaches.slice(0, 2000);
  }
  const updated = await updateBusiness(input.customerId, input.businessId, patch);
  await audit({
    actorCustomerId: input.customerId,
    action: "instagram.customer.confirm",
    entityType: "customer_instagram_analysis",
    entityId: row.id,
    metadata: { businessId: input.businessId, overwritten: false },
  });
  return { analysis: await getLatestAnalysis(input.customerId, input.businessId), business: updated };
}
