import { requireCustomer } from "@/lib/auth";
import { errorJson, json, readJson } from "@/lib/http";
import { getCampaign } from "@/lib/queries/campaigns";
import { withdrawApproval } from "@/lib/instagram/publications";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const campaign = await getCampaign(auth.customer.id, id);
  if (!campaign) return errorJson("Campaign not found", 404);
  const body = await readJson<{ action?: string; publicationId?: string }>(request);
  if (body?.action !== "withdraw") return errorJson("Unknown action", 400);
  const publicationId = body.publicationId?.trim();
  if (!publicationId) return errorJson("Choose the approval to withdraw.");
  const owned = campaign.publications.find((item) => item.id === publicationId);
  if (!owned) return errorJson("Approval not found.", 404);
  const result = await withdrawApproval({
    customerId: auth.customer.id,
    publicationId,
  });
  if ("error" in result) return errorJson(result.error, result.status);
  const updated = await getCampaign(auth.customer.id, id);
  return json({ campaign: updated, publication: result });
}
