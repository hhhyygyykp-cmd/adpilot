import { requireCustomer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { errorJson, json, readJson } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { getActiveBusiness, getBusiness } from "@/lib/queries/businesses";
import { listCampaigns, startCampaign } from "@/lib/queries/campaigns";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  return json({ campaigns: await listCampaigns(auth.customer.id) });
}

export async function POST(request: Request) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const limited = rateLimit(clientKey(request, `campaigns:${auth.customer.id}`), 30, 60 * 60 * 1000);
  if (!limited.ok) return errorJson("Too many campaigns. Try again shortly.", 429);
  const body = await readJson<{ prompt?: string; businessId?: string }>(request);
  const prompt = (body?.prompt ?? "").trim();
  if (prompt.length < 3) return errorJson("Tell us what you would like to advertise");
  const business = body?.businessId
    ? await getBusiness(auth.customer.id, body.businessId)
    : await getActiveBusiness(auth.customer.id);
  if (!business || !business.name.trim()) {
    return errorJson("Add a business profile first", 409);
  }
  const campaign = await startCampaign({
    customerId: auth.customer.id,
    business,
    prompt,
    language: auth.customer.preferredLanguage,
  });
  await audit({
    actorCustomerId: auth.customer.id,
    action: "campaign.start",
    entityType: "campaign",
    entityId: campaign.id,
  });
  return json({ campaign }, 201);
}
