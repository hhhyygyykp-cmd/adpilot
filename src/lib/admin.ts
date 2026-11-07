import "server-only";

import { sql } from "./db";

function allowList(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function adminAllowList(): string[] {
  return allowList();
}

export async function isAdminEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (allowList().includes(normalized)) return true;
  const redeemed = await sql<{ id: string }>(
    `select id from admin_invites
     where lower(email) = $1 and used_at is not null
     limit 1`,
    [normalized],
  );
  return redeemed.length > 0;
}

export async function findValidInvite(email: string, tokenHash: string) {
  const rows = await sql<{ id: string; email: string }>(
    `select id, email from admin_invites
     where token_hash = $1
       and lower(email) = lower($2)
       and used_at is null
       and expires_at > now()
     limit 1`,
    [tokenHash, email],
  );
  return rows[0] ?? null;
}

export async function redeemInvite(id: string) {
  await sql(`update admin_invites set used_at = now() where id = $1 and used_at is null`, [
    id,
  ]);
}
