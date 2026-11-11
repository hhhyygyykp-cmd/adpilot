import "server-only";

import { sql } from "./db";

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const safeKey = key.slice(0, 200);
  const resetAt = new Date(Date.now() + windowMs).toISOString();
  const rows = await sql<{ count: number; reset_at: string }>(
    `insert into rate_limit_buckets (key, count, reset_at)
     values ($1, 1, $2)
     on conflict (key) do update set
       count = case
         when rate_limit_buckets.reset_at <= now() then 1
         else rate_limit_buckets.count + 1
       end,
       reset_at = case
         when rate_limit_buckets.reset_at <= now() then excluded.reset_at
         else rate_limit_buckets.reset_at
       end
     returning count, reset_at`,
    [safeKey, resetAt],
  );
  const row = rows[0];
  if (!row) return { ok: true };
  if (row.count > limit) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000),
    );
    return { ok: false, retryAfterSec };
  }
  if (Math.random() < 0.02) {
    await sql(`delete from rate_limit_buckets where reset_at <= now()`).catch(() => undefined);
  }
  return { ok: true };
}

export function clientKey(request: Request, extra = ""): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "local";
  return `${ip.slice(0, 80)}:${extra}`;
}
