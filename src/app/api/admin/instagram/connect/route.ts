import { requireAdmin } from "@/lib/auth";
import { errorJson, json } from "@/lib/http";
import { startInstagramOAuth } from "@/lib/instagram/connection";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const limited = rateLimit(clientKey(request, `ig-connect:${auth.customer.id}`), 8, 10 * 60 * 1000);
  if (!limited.ok) return errorJson("Too many Instagram connect attempts. Try again shortly.", 429);
  const result = await startInstagramOAuth({
    request,
    adminCustomerId: auth.customer.id,
  });
  if ("error" in result) return errorJson(result.error, result.status);
  return json({ url: result.url });
}
