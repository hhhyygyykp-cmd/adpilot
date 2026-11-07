import { requireCustomer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { errorJson, json, readJson } from "@/lib/http";
import { getBusiness } from "@/lib/queries/businesses";
import { getCampaign } from "@/lib/queries/campaigns";
import { generateCampaignMedia } from "@/lib/queries/creatives";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const campaign = await getCampaign(auth.customer.id, id);
  if (!campaign) return errorJson("Campaign not found", 404);
  if (campaign.status !== "confirmed") {
    return errorJson("Confirm the brief and concept before generating", 409);
  }
  const business = await getBusiness(auth.customer.id, campaign.businessId);
  if (!business) return errorJson("Business not found", 404);
  const body = await readJson<{ authorizePaid?: boolean; video?: boolean }>(request);
  const authorizePaid = Boolean(body?.authorizePaid);
  const result = await generateCampaignMedia({
    campaign,
    business,
    authorizePaid,
    wantVideo: Boolean(body?.video) || campaign.mediaQuote.wantsVideo,
  });
  const updated = await getCampaign(auth.customer.id, id);
  await audit({
    actorCustomerId: auth.customer.id,
    action: "campaign.generate",
    entityType: "campaign",
    entityId: id,
    metadata: {
      status: result.status,
      note: result.note,
      authorizePaid,
      provider: authorizePaid ? "fal" : "pollinations",
    },
  });
  return json({ campaign: updated, generation: result });
}
