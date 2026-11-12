import { requireAdmin } from "@/lib/auth";
import { errorJson, json, readJson } from "@/lib/http";
import { completeInstagramOAuth, getAgencyInstagramPublic } from "@/lib/instagram/connection";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const limited = await rateLimit(clientKey(request, `ig-complete:${auth.customer.id}`), 8, 10 * 60 * 1000);
  if (!limited.ok) return errorJson("Too many Instagram connect attempts. Try again shortly.", 429);
  const body = await readJson<{ state?: string }>(request);
  const result = await completeInstagramOAuth({
    adminCustomerId: auth.customer.id,
    state: typeof body?.state === "string" ? body.state : null,
  });
  if ("error" in result) return errorJson(result.error, result.status);
  return json({ instagram: await getAgencyInstagramPublic(request), username: result.username });
}
