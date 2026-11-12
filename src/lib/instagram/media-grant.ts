import "server-only";

import { newId, randomToken, sha256 } from "../crypto";
import { sql } from "../db";
import { publicOriginFromRequest } from "./config";

const GRANT_TTL_MS = 15 * 60 * 1000;
const TOKEN_BYTES = 48;

export async function createMediaGrant(input: {
  request: Request;
  creativeId: string;
  publicationId: string;
}): Promise<{ url: string; token: string }> {
  await sql(`delete from instagram_media_grants where expires_at <= now()`);
  const token = randomToken(TOKEN_BYTES);
  await sql(
    `insert into instagram_media_grants (id, token_hash, creative_id, publication_id, expires_at, ttl_seconds)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      newId(),
      sha256(token),
      input.creativeId,
      input.publicationId,
      new Date(Date.now() + GRANT_TTL_MS).toISOString(),
      GRANT_TTL_MS / 1000,
    ],
  );
  const origin = publicOriginFromRequest(input.request);
  return {
    token,
    url: `${origin}/api/instagram/media/${token}`,
  };
}

export async function readGrantedCreative(token: string) {
  if (!token || token.length < 40) return null;
  const rows = await sql<{
    creative_id: string;
    storage_key: string;
    mime_type: string;
    original_name: string;
    expires_at: string;
  }>(
    `select g.creative_id, c.storage_key, c.mime_type, c.original_name, g.expires_at
     from instagram_media_grants g
     join campaign_creatives c on c.id = g.creative_id
     join instagram_publications p on p.id = g.publication_id
     where g.token_hash = $1
       and g.expires_at > now()
       and p.publish_status = 'publishing'
     limit 1`,
    [sha256(token)],
  );
  return rows[0] ?? null;
}
