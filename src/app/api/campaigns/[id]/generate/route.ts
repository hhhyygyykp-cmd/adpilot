import { requireCustomer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { errorJson, json, readJson } from "@/lib/http";
import { getBusiness } from "@/lib/queries/businesses";
import { getCampaign } from "@/lib/queries/campaigns";
import { paidConsentDecision } from "@/lib/media/paid-consent";
import { generateCampaignMedia } from "@/lib/queries/creatives";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

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
  const body = await readJson<{ authorizePaid?: unknown; acceptedQuoteUsd?: unknown; video?: boolean }>(request);
  const decision = paidConsentDecision({
    authorizePaid: body?.authorizePaid,
    acceptedQuoteUsd: body?.acceptedQuoteUsd,
    quoteUsd: campaign.mediaQuote.totalUsd,
    status: campaign.status,
    generationStatus: campaign.generationStatus,
  });
  const requestedPaid = body?.authorizePaid;
  if (requestedPaid !== undefined && requestedPaid !== false && requestedPaid !== true) {
    return errorJson("Paid generation was not authorized. No paid call was made.", 409);
  }
  if (requestedPaid === true && !decision.allowPaid) {
    return errorJson(decision.error ?? "Paid generation was not authorized. No paid call was made.", 409);
  }
  const authorizePaid = decision.allowPaid;
  const result = await generateCampaignMedia({
    campaign,
    business,
    authorizePaid,
    wantVideo: Boolean(body?.video) || campaign.mediaQuote.wantsVideo,
  });
  if (result.duplicate) {
    return errorJson(result.note, 409);
  }
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
      provider: authorizePaid && !/no paid/i.test(result.note) ? "fal" : "local",
    },
  });
  return json({ campaign: updated, generation: result });
}
