import { requireCustomer } from "@/lib/auth";
import { errorJson, json } from "@/lib/http";
import { setActiveBusiness } from "@/lib/queries/businesses";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const business = await setActiveBusiness(auth.customer.id, id);
  if (!business) return errorJson("Business not found", 404);
  return json({ business });
}
