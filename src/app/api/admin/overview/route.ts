import { adminAllowList } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const [customers] = await sql<{ n: string }>(`select count(*)::text as n from customers`);
  const [businesses] = await sql<{ n: string }>(`select count(*)::text as n from businesses`);
  const [campaigns] = await sql<{ n: string }>(`select count(*)::text as n from campaigns`);
  const invites = await sql<{
    id: string;
    email: string;
    used_at: string | null;
    expires_at: string;
    created_at: string;
  }>(
    `select id, email, used_at, expires_at, created_at from admin_invites order by created_at desc limit 50`,
  );
  return json({
    counts: {
      customers: Number(customers?.n ?? 0),
      businesses: Number(businesses?.n ?? 0),
      campaigns: Number(campaigns?.n ?? 0),
      jobs: 0,
    },
    allowList: adminAllowList(),
    invites: invites.map((row) => ({
      id: row.id,
      email: row.email,
      usedAt: row.used_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    })),
  });
}
