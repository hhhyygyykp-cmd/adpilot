import "server-only";

import { audit } from "../audit";
import { decryptSecret, encryptSecret, newId, randomToken } from "../crypto";
import { parseJson, sql } from "../db";
import {
  HOSTED_CALLBACK,
  TARGET_INSTAGRAM_USERNAME,
  UNIFIED_PERMISSIONS,
  hostedOrigin,
  instagramRedirectUri,
  metaAppSecret,
  metaConfigured,
  missingMetaSecrets,
  normalizeInstagramUsername,
  publicOriginFromRequest,
} from "./config";
import {
  authorizationUrl,
  exchangeAuthorizationCode,
  fetchInstagramProfile,
  listAvailableInstagramAccounts,
  listGrantedPermissions,
  publicInstagramError,
  selectAgencyAccount,
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
  missingSecrets: string[];
  login: "unified";
  targetUsername: string;
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
  const missing = missingMetaSecrets();
  const configured = missing.length === 0;
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
    redirectUri: HOSTED_CALLBACK,
    publicOrigin: hostedOrigin() || publicOriginFromRequest(request),
    scopes: [...UNIFIED_PERMISSIONS],
    missingSecrets: missing,
    login: "unified",
    targetUsername: TARGET_INSTAGRAM_USERNAME,
  };
}

export async function getAgencyInstagramPublic(request: Request): Promise<AgencyInstagramPublic> {
  return mapPublic(request, await loadAccount());
}

export async function startInstagramOAuth(input: {
  request: Request;
  adminCustomerId: string;
}): Promise<{ url: string } | { error: string; status: number }> {
  const missing = missingMetaSecrets();
  if (missing.length) {
    return {
      error: `Add these Cursor secrets, then connect Instagram: ${missing.join(", ")}. Redirect URI: ${HOSTED_CALLBACK}`,
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
      redirectUri: instagramRedirectUri(),
      state,
    }),
  };
}

async function storeConnection(input: {
  adminCustomerId: string;
  token: string;
  expiresIn: number;
  permissions: string[];
}): Promise<{ username: string }> {
  const accounts = await listAvailableInstagramAccounts(input.token);
  const selected = selectAgencyAccount(accounts);
  if (!selected) {
    throw new Error(
      "Meta did not share any Instagram professional account. Select the agency account during Unified Login.",
    );
  }
  let profile = {
    id: selected.id,
    userId: selected.id,
    username: selected.username,
    accountType: "",
    name: "",
  };
  try {
    const live = await fetchInstagramProfile(input.token, selected.id);
    profile = {
      ...live,
      username: live.username || selected.username,
    };
  } catch {
    if (!selected.username) {
      throw new Error(
        "Meta shared an Instagram account id but did not return a username. Connect again and select @adpilot.ae.",
      );
    }
  }
  const username = profile.username;
  const granted = input.permissions.length
    ? input.permissions
    : (await listGrantedPermissions(input.token)) || [...UNIFIED_PERMISSIONS];
  const expiresAt =
    input.expiresIn > 0 ? new Date(Date.now() + input.expiresIn * 1000).toISOString() : null;
  const ciphertext = encryptSecret(input.token, metaAppSecret());
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
      username,
      profile.accountType,
      profile.name,
      JSON.stringify(granted),
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
      username,
      igUserId: profile.userId || profile.id,
      permissions: granted,
      login: "unified",
      matchedTarget: normalizeInstagramUsername(username) === TARGET_INSTAGRAM_USERNAME,
    },
  });
  return { username };
}

export async function receiveInstagramOAuthCallback(input: {
  code: string | null;
  state: string | null;
  oauthError: string | null;
}): Promise<{ ok: true; state: string } | { error: string; status: number }> {
  if (input.oauthError) {
    return { error: `Instagram authorization was not completed (${input.oauthError}).`, status: 400 };
  }
  if (!input.code || !input.state) {
    return { error: "Meta did not return an authorization code.", status: 400 };
  }
  if (input.code.length > 2048 || input.state.length > 128) {
    return { error: "This Instagram connection link is invalid.", status: 400 };
  }
  const rows = await sql<{ state: string; authorization_code: string | null }>(
    `select state, authorization_code from instagram_oauth_states
     where state = $1 and expires_at > now()`,
    [input.state],
  );
  const row = rows[0];
  if (!row) return { error: "This Instagram connection link expired. Start Connect Instagram again.", status: 400 };
  if (!row.authorization_code) {
    await sql(
      `update instagram_oauth_states
       set authorization_code = $2
       where state = $1 and authorization_code is null`,
      [input.state, input.code],
    );
  }
  return { ok: true, state: row.state };
}

export async function completeInstagramOAuth(input: {
  adminCustomerId: string;
  state: string | null;
}): Promise<{ ok: true; username: string } | { error: string; status: number }> {
  if (!input.adminCustomerId) {
    return { error: "Sign in as an administrator to finish Instagram linking.", status: 401 };
  }
  if (!input.state) {
    return { error: "This Instagram connection link expired. Start Connect Instagram again.", status: 400 };
  }
  const pending = await sql<{ admin_customer_id: string; authorization_code: string | null }>(
    `select admin_customer_id, authorization_code from instagram_oauth_states
     where state = $1 and expires_at > now()`,
    [input.state],
  );
  const expected = pending[0];
  if (!expected) return { error: "This Instagram connection link expired. Start Connect Instagram again.", status: 400 };
  if (expected.admin_customer_id !== input.adminCustomerId) {
    return { error: "Sign in as the same administrator who started Connect Instagram.", status: 403 };
  }
  if (!expected.authorization_code) {
    return { error: "Finish Instagram login, then return to the AdPilot app.", status: 400 };
  }
  const consumed = await sql<{ authorization_code: string }>(
    `delete from instagram_oauth_states
     where state = $1 and admin_customer_id = $2 and authorization_code is not null
     returning authorization_code`,
    [input.state, input.adminCustomerId],
  );
  const code = consumed[0]?.authorization_code;
  if (!code) return { error: "This Instagram connection link expired. Start Connect Instagram again.", status: 400 };
  if (!metaConfigured()) {
    return {
      error: `Add these Cursor secrets, then connect Instagram: ${missingMetaSecrets().join(", ")}. Redirect URI: ${HOSTED_CALLBACK}`,
      status: 409,
    };
  }
  try {
    const exchanged = await exchangeAuthorizationCode({
      code,
      redirectUri: instagramRedirectUri(),
    });
    const saved = await storeConnection({
      adminCustomerId: input.adminCustomerId,
      token: exchanged.accessToken,
      expiresIn: exchanged.expiresIn,
      permissions: exchanged.permissions,
    });
    return { ok: true, username: saved.username };
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
    const accounts = await listAvailableInstagramAccounts(live.token);
    const selected = selectAgencyAccount(accounts);
    if (!selected) {
      throw new Error("Meta no longer shares an Instagram professional account for this token.");
    }
    let profile = {
      id: selected.id,
      userId: selected.id,
      username: selected.username,
      accountType: "",
      name: "",
    };
    try {
      const liveProfile = await fetchInstagramProfile(live.token, selected.id);
      profile = {
        ...liveProfile,
        username: liveProfile.username || selected.username,
      };
    } catch {
      if (!selected.username) throw new Error("Meta no longer shares the Instagram username for this token.");
    }
    const permissions = (await listGrantedPermissions(live.token)) || [];
    await sql(
      `update agency_social_accounts set
         username = $2,
         account_type = $3,
         name = $4,
         ig_user_id = $5,
         permissions = coalesce(nullif($6::jsonb, '[]'::jsonb), permissions),
         status = 'connected',
         last_error = '',
         last_refreshed_at = now(),
         updated_at = now()
       where id = $1`,
      [
        live.id,
        profile.username || selected.username,
        profile.accountType,
        profile.name,
        profile.userId || profile.id,
        JSON.stringify(permissions),
      ],
    );
    await audit({
      actorCustomerId: adminCustomerId,
      action: "instagram.refresh",
      entityType: "agency_social_account",
      entityId: live.id,
      metadata: { username: profile.username || selected.username, login: "unified" },
    });
    return { ok: true };
  } catch (error) {
    const message = publicInstagramError(error, "Instagram connection refresh failed.");
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
      error: `Add these Cursor secrets, then connect Instagram: ${missingMetaSecrets().join(", ")}. Redirect URI: ${HOSTED_CALLBACK}`,
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
