import { requireCustomer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { errorJson, json, readJson } from "@/lib/http";
import { chooseConcept, getCampaign } from "@/lib/queries/campaigns";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const campaign = await getCampaign(auth.customer.id, id);
  if (!campaign) return errorJson("Campaign not found", 404);
  const body = await readJson<{ conceptId?: string; useRecommended?: boolean }>(request);
  const updated = await chooseConcept({
    campaign,
    conceptId: body?.conceptId,
    useRecommended: Boolean(body?.useRecommended),
    language: auth.customer.preferredLanguage,
  });
  if ("error" in updated) return errorJson(updated.error, updated.status);
  await audit({
    actorCustomerId: auth.customer.id,
    action: "campaign.concept",
    entityType: "campaign",
    entityId: updated.id,
    metadata: {
      selectedId: updated.conceptSet?.selectedId ?? null,
      chosenBy: updated.conceptSet?.chosenBy ?? null,
    },
  });
  return json({ campaign: updated });
}
