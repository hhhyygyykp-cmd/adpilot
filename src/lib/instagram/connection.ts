import "server-only";

import { audit } from "../audit";
import { decryptSecret, encryptSecret, newId, randomToken } from "../crypto";
import { parseJson, sql } from "../db";
import {
  INSTAGRAM_SCOPES,
  instagramRedirectUri,
  metaAppSecret,
  metaConfigured,
  publicOriginFromRequest,
} from "./config";
import {
  authorizationUrl,
  exchangeAuthorizationCode,
  exchangeLongLivedToken,
  fetchInstagramProfile,
  publicInstagramError,
  refreshLongLivedToken,
} from "./meta";

export type AgencyInstagramPublic = {
  configured: boolean;
  status: "not_configured" | "disconnected" | "connected" | "expired" | "needs_reauth";
  username: string | null;
  igUserId: string | null;
  accountType: string | null;
  name: string | null;
  permissions: string[];
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  lastRefreshedAt: string | null;
  lastError: string;
  redirectUri: string;
  publicOrigin: string;
  scopes: string[];
};

type AccountRow = {
  id: string;
  platform: string;
  ig_user_id: string | null;
  username: string | null;
  account_type: string | null;
  name: string | null;
  permissions: unknown;
  token_ciphertext: string | null;
  token_expires_at: string | null;
  status: "disconnected" | "connected" | "expired" | "needs_reauth";
  last_error: string;
  connected_at: string | null;
  last_refreshed_at: string | null;
};

const PLATFORM = "instagram";

async function loadAccount(): Promise<AccountRow | null> {
  const rows = await sql<AccountRow>(
    `select * from agency_social_accounts where platform = $1 limit 1`,
    [PLATFORM],
  );
  return rows[0] ?? null;
}

async function ensureAccount(): Promise<AccountRow> {
  const existing = await loadAccount();
  if (existing) return existing;
  const id = newId();
  await sql(
    `insert into agency_social_accounts (id, platform, status)
     values ($1, $2, 'disconnected')
     on conflict (platform) do nothing`,
    [id, PLATFORM],
  );
  const created = await loadAccount();
  if (!created) throw new Error("Could not create the agency Instagram row.");
  return created;
}

function mapPublic(request: Request, row: AccountRow | null): AgencyInstagramPublic {
  const configured = metaConfigured();
  const expired =
    row?.token_expires_at && new Date(row.token_expires_at).getTime() <= Date.now();
  let status: AgencyInstagramPublic["status"] = "not_configured";
  if (configured) {
    if (!row || row.status === "disconnected" || !row.token_ciphertext) status = "disconnected";
    else if (row.status === "needs_reauth") status = "needs_reauth";
    else if (row.status === "expired" || expired) status = "expired";
    else status = row.status;
  }
  return {
    configured,
    status,
    username: row?.username || null,
    igUserId: row?.ig_user_id || null,
    accountType: row?.account_type || null,
    name: row?.name || null,
    permissions: parseJson<string[]>(row?.permissions, []),
    connectedAt: row?.connected_at ? new Date(row.connected_at).toISOString() : null,
    tokenExpiresAt: row?.token_expires_at ? new Date(row.token_expires_at).toISOString() : null,
    lastRefreshedAt: row?.last_refreshed_at
      ? new Date(row.last_refreshed_at).toISOString()
      : null,
    lastError: row?.last_error ?? "",
    redirectUri: instagramRedirectUri(request),
    publicOrigin: publicOriginFromRequest(request),
    scopes: [...INSTAGRAM_SCOPES],
  };
}

export async function getAgencyInstagramPublic(request: Request): Promise<AgencyInstagramPublic> {
  return mapPublic(request, await loadAccount());
}

export async function startInstagramOAuth(input: {
  request: Request;
  adminCustomerId: string;
}): Promise<{ url: string } | { error: string; status: number }> {
  if (!metaConfigured()) {
    return {
      error:
        "META_APP_ID and META_APP_SECRET are not on the server yet. Add them in Cursor secrets, then connect Instagram.",
      status: 409,
    };
  }
  await sql(`delete from instagram_oauth_states where expires_at <= now()`);
  const state = randomToken(24);
  await sql(
    `insert into instagram_oauth_states (id, state, admin_customer_id, expires_at)
     values ($1, $2, $3, $4)`,
    [newId(), state, input.adminCustomerId, new Date(Date.now() + 10 * 60 * 1000).toISOString()],
  );
  return {
    url: authorizationUrl({
      redirectUri: instagramRedirectUri(input.request),
      state,
    }),
  };
}

export async function completeInstagramOAuth(input: {
  request: Request;
  adminCustomerId: string;
  code: string | null;
  state: string | null;
  oauthError: string | null;
}): Promise<{ ok: true } | { error: string; status: number }> {
  if (input.oauthError) {
    return { error: `Instagram authorization was not completed (${input.oauthError}).`, status: 400 };
  }
  if (!input.code || !input.state) {
    return { error: "Instagram did not return an authorization code.", status: 400 };
  }
  if (!metaConfigured()) {
    return { error: "META_APP_ID and META_APP_SECRET are missing, so the token cannot be stored.", status: 409 };
  }
  const states = await sql<{ admin_customer_id: string }>(
    `delete from instagram_oauth_states
     where state = $1 and expires_at > now()
     returning admin_customer_id`,
    [input.state],
  );
  const expected = states[0];
  if (!expected) return { error: "This Instagram connection link expired. Start Connect Instagram again.", status: 400 };
  if (expected.admin_customer_id !== input.adminCustomerId) {
    return { error: "Sign in as the same administrator who started Connect Instagram.", status: 403 };
  }
  try {
    const shortLived = await exchangeAuthorizationCode({
      code: input.code,
      redirectUri: instagramRedirectUri(input.request),
    });
    const longLived = await exchangeLongLivedToken(shortLived.accessToken);
    const profile = await fetchInstagramProfile(longLived.accessToken);
    const expiresAt =
      longLived.expiresIn > 0
        ? new Date(Date.now() + longLived.expiresIn * 1000).toISOString()
        : null;
    const permissions =
      shortLived.permissions.length > 0 ? shortLived.permissions : [...INSTAGRAM_SCOPES];
    const ciphertext = encryptSecret(longLived.accessToken, metaAppSecret());
    const row = await ensureAccount();
    await sql(
      `update agency_social_accounts set
         ig_user_id = $2,
         username = $3,
         account_type = $4,
         name = $5,
         permissions = $6::jsonb,
         token_ciphertext = $7,
         token_expires_at = $8,
         status = 'connected',
         last_error = '',
         connected_at = now(),
         connected_by = $9,
         last_refreshed_at = now(),
         updated_at = now()
       where id = $1`,
      [
        row.id,
        profile.userId || profile.id,
        profile.username,
        profile.accountType,
        profile.name,
        JSON.stringify(permissions),
        ciphertext,
        expiresAt,
        input.adminCustomerId,
      ],
    );
    await audit({
      actorCustomerId: input.adminCustomerId,
      action: "instagram.connect",
      entityType: "agency_social_account",
      entityId: row.id,
      metadata: {
        username: profile.username,
        igUserId: profile.userId || profile.id,
        permissions,
      },
    });
    return { ok: true };
  } catch (error) {
    const message = publicInstagramError(error, "Instagram authorization failed.");
    const row = await ensureAccount();
    await sql(
      `update agency_social_accounts set last_error = $2, updated_at = now() where id = $1`,
      [row.id, message],
    );
    return { error: message, status: 502 };
  }
}

export async function disconnectInstagram(adminCustomerId: string): Promise<void> {
  const row = await ensureAccount();
  await sql(
    `update agency_social_accounts set
       ig_user_id = null,
       username = null,
       account_type = null,
       name = null,
       permissions = '[]'::jsonb,
       token_ciphertext = null,
       token_expires_at = null,
       status = 'disconnected',
       last_error = '',
       connected_at = null,
       connected_by = null,
       last_refreshed_at = null,
       updated_at = now()
     where id = $1`,
    [row.id],
  );
  await audit({
    actorCustomerId: adminCustomerId,
    action: "instagram.disconnect",
    entityType: "agency_social_account",
    entityId: row.id,
  });
}

export async function refreshInstagramConnection(adminCustomerId: string): Promise<{
  ok: true;
} | { error: string; status: number }> {
  const live = await readLiveConnection();
  if ("error" in live) return live;
  try {
    const refreshed = await refreshLongLivedToken(live.token);
    const profile = await fetchInstagramProfile(refreshed.accessToken);
    const expiresAt =
      refreshed.expiresIn > 0
        ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
        : live.expiresAt;
    await sql(
      `update agency_social_accounts set
         token_ciphertext = $2,
         token_expires_at = $3,
         username = $4,
         account_type = $5,
         name = $6,
         ig_user_id = $7,
         status = 'connected',
         last_error = '',
         last_refreshed_at = now(),
         updated_at = now()
       where id = $1`,
      [
        live.id,
        encryptSecret(refreshed.accessToken, metaAppSecret()),
        expiresAt,
        profile.username,
        profile.accountType,
        profile.name,
        profile.userId || profile.id,
      ],
    );
    await audit({
      actorCustomerId: adminCustomerId,
      action: "instagram.refresh",
      entityType: "agency_social_account",
      entityId: live.id,
      metadata: { username: profile.username },
    });
    return { ok: true };
  } catch (error) {
    const message = publicInstagramError(error, "Instagram token refresh failed.");
    await sql(
      `update agency_social_accounts set status = 'needs_reauth', last_error = $2, updated_at = now()
       where id = $1`,
      [live.id, message],
    );
    return { error: message, status: 502 };
  }
}

export async function readLiveConnection(): Promise<
  | {
      id: string;
      token: string;
      igUserId: string;
      username: string;
      expiresAt: string | null;
    }
  | { error: string; status: number }
> {
  if (!metaConfigured()) {
    return {
      error: "META_APP_ID and META_APP_SECRET are not configured, so Instagram is not connected.",
      status: 409,
    };
  }
  const row = await loadAccount();
  if (!row?.token_ciphertext || !row.ig_user_id) {
    return { error: "The agency Instagram account is not connected.", status: 409 };
  }
  if (row.status !== "connected") {
    return {
      error:
        row.last_error ||
        "The agency Instagram account needs to be connected again before publishing.",
      status: 409,
    };
  }
  if (row.token_expires_at && new Date(row.token_expires_at).getTime() <= Date.now()) {
    await sql(
      `update agency_social_accounts set status = 'expired', last_error = $2, updated_at = now()
       where id = $1`,
      [row.id, "The Instagram access token has expired."],
    );
    return { error: "The Instagram access token has expired. Connect Instagram again.", status: 409 };
  }
  try {
    const token = decryptSecret(row.token_ciphertext, metaAppSecret());
    return {
      id: row.id,
      token,
      igUserId: row.ig_user_id,
      username: row.username || "",
      expiresAt: row.token_expires_at,
    };
  } catch {
    return { error: "The stored Instagram token could not be decrypted. Connect Instagram again.", status: 409 };
  }
}
