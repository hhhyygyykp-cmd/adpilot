import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { json } from "@/lib/http";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const rows = await sql<{
    id: string;
    email: string;
    name: string;
    preferred_language: string;
    created_at: string;
  }>(
    `select id, email, name, preferred_language, created_at from customers order by created_at desc limit 200`,
  );
  const customers = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      preferredLanguage: row.preferred_language,
      createdAt: row.created_at,
      isAdmin: await isAdminEmail(row.email),
    })),
  );
  return json({ customers });
}
