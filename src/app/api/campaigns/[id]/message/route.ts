import { requireCustomer } from "@/lib/auth";
import { errorJson, json, readJson } from "@/lib/http";
import { getBusiness } from "@/lib/queries/businesses";
import { continueCampaign, getCampaign } from "@/lib/queries/campaigns";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const campaign = await getCampaign(auth.customer.id, id);
  if (!campaign) return errorJson("Campaign not found", 404);
  const business = await getBusiness(auth.customer.id, campaign.businessId);
  if (!business) return errorJson("Business not found", 404);
  const body = await readJson<{ text?: string; skip?: boolean; skipRemaining?: boolean }>(request);
  const updated = await continueCampaign({
    campaign,
    business,
    text: body?.text ?? "",
    skip: Boolean(body?.skip),
    skipRemaining: Boolean(body?.skipRemaining),
    language: auth.customer.preferredLanguage,
  });
  return json({ campaign: updated });
}
