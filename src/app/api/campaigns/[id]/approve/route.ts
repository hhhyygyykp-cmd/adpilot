import { requireCustomer } from "@/lib/auth";
import { errorJson, json, readJson } from "@/lib/http";
import { getBusiness } from "@/lib/queries/businesses";
import { getCampaign } from "@/lib/queries/campaigns";
import { getOwnedCreative } from "@/lib/queries/creatives";
import { approveCreative } from "@/lib/instagram/publications";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const campaign = await getCampaign(auth.customer.id, id);
  if (!campaign) return errorJson("Campaign not found", 404);
  if (campaign.status !== "confirmed") {
    return errorJson("Confirm the brief before approving an advertisement.", 409);
  }
  const business = await getBusiness(auth.customer.id, campaign.businessId);
  if (!business) return errorJson("Business not found", 404);
  const body = await readJson<{ creativeId?: string; caption?: string; requestedAt?: string }>(request);
  const creativeId = body?.creativeId?.trim();
  if (!creativeId) return errorJson("Choose the finished advertisement to approve.");
  const owned = await getOwnedCreative(auth.customer.id, creativeId, false);
  if (!owned || owned.campaign_id !== campaign.id) {
    return errorJson("That advertisement was not found.", 404);
  }
  const creative = campaign.creatives.find((item) => item.id === creativeId);
  if (!creative) return errorJson("That advertisement was not found.", 404);
  const result = await approveCreative({
    customerId: auth.customer.id,
    campaign,
    business,
    creative,
    caption: body?.caption,
    requestedAt: body?.requestedAt,
  });
  if ("error" in result) return errorJson(result.error, result.status);
  const updated = await getCampaign(auth.customer.id, id);
  return json({ campaign: updated, publication: result });
}
