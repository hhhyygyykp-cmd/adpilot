import { requireCustomer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { errorJson, json } from "@/lib/http";
import { getBusiness } from "@/lib/queries/businesses";
import { confirmCampaign, getCampaign } from "@/lib/queries/campaigns";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const campaign = await getCampaign(auth.customer.id, id);
  if (!campaign) return errorJson("Campaign not found", 404);
  if (campaign.status === "drafting") {
    return errorJson("Finish the conversation before confirming");
  }
  const business = await getBusiness(auth.customer.id, campaign.businessId);
  if (!business) return errorJson("Business not found", 404);
  const updated = await confirmCampaign(auth.customer.id, campaign, business);
  if ("error" in updated) return errorJson(updated.error, updated.status);
  await audit({
    actorCustomerId: auth.customer.id,
    action: "campaign.confirm",
    entityType: "campaign",
    entityId: updated.id,
    metadata: {
      productName: updated.productName,
      offer: updated.offer,
      objective: updated.objective,
      concept: updated.conceptSet?.selectedId ?? null,
      chosenBy: updated.conceptSet?.chosenBy ?? null,
      generation: "not_started",
    },
  });
  return json({ campaign: updated });
}
