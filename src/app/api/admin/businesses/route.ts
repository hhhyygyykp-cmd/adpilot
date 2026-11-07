import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const rows = await sql<{
    id: string;
    name: string;
    category: string;
    customer_id: string;
    customer_email: string;
    onboarding_complete: boolean;
    created_at: string;
  }>(
    `select b.id, b.name, b.category, b.customer_id, c.email as customer_email,
            b.onboarding_complete, b.created_at
     from businesses b
     join customers c on c.id = b.customer_id
     order by b.updated_at desc
     limit 200`,
  );
  return json({
    businesses: rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      customerId: row.customer_id,
      customerEmail: row.customer_email,
      onboardingComplete: row.onboarding_complete,
      createdAt: row.created_at,
    })),
  });
}
