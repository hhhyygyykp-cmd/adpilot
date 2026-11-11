import "server-only";

import { newId, randomToken, sha256 } from "../crypto";
import { sql } from "../db";
import { publicOriginFromRequest } from "./config";

export async function createMediaGrant(input: {
  request: Request;
  creativeId: string;
  publicationId: string;
}): Promise<{ url: string; token: string }> {
  await sql(`delete from instagram_media_grants where expires_at <= now()`);
  const token = randomToken(32);
  await sql(
    `insert into instagram_media_grants (id, token_hash, creative_id, publication_id, expires_at)
     values ($1, $2, $3, $4, $5)`,
    [
      newId(),
      sha256(token),
      input.creativeId,
      input.publicationId,
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ],
  );
  const origin = publicOriginFromRequest(input.request);
  return {
    token,
    url: `${origin}/api/instagram/media/${token}`,
  };
}

export async function readGrantedCreative(token: string) {
  if (!token || token.length < 20) return null;
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
     where g.token_hash = $1
     limit 1`,
    [sha256(token)],
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row;
}
