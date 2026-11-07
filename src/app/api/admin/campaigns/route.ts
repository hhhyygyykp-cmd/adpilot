import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const rows = await sql<{
    id: string;
    status: string;
    product_name: string | null;
    offer: string | null;
    objective: string | null;
    customer_email: string;
    business_name: string;
    updated_at: string;
  }>(
    `select c.id, c.status, c.product_name, c.offer, c.objective,
            cu.email as customer_email, b.name as business_name, c.updated_at
     from campaigns c
     join customers cu on cu.id = c.customer_id
     join businesses b on b.id = c.business_id
     order by c.updated_at desc
     limit 200`,
  );
  return json({
    campaigns: rows.map((row) => ({
      id: row.id,
      status: row.status,
      productName: row.product_name,
      offer: row.offer,
      objective: row.objective,
      customerEmail: row.customer_email,
      businessName: row.business_name,
      updatedAt: row.updated_at,
    })),
  });
}
