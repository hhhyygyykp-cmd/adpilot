import { requireCustomer } from "@/lib/auth";
import { errorJson, json } from "@/lib/http";
import { startCustomerInstagramOAuth } from "@/lib/instagram/customer";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const limited = await rateLimit(clientKey(request, `ig-customer-connect:${auth.customer.id}`), 8, 10 * 60 * 1000);
  if (!limited.ok) return errorJson("Too many Instagram connect attempts. Try again shortly.", 429);
  const result = await startCustomerInstagramOAuth({
    customerId: auth.customer.id,
    businessId: id,
  });
  if ("error" in result) return errorJson(result.error, result.status);
  return json({ url: result.url });
}
