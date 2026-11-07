import { requireCustomer } from "@/lib/auth";
import { errorJson, json } from "@/lib/http";
import { getCampaign } from "@/lib/queries/campaigns";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const campaign = await getCampaign(auth.customer.id, id);
  if (!campaign) return errorJson("Campaign not found", 404);
  return json({ campaign });
}
