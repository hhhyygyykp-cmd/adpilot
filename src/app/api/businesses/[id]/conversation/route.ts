import { requireCustomer } from "@/lib/auth";
import { errorJson, json, readJson } from "@/lib/http";
import { continueBusinessOnboarding, getBusiness } from "@/lib/queries/businesses";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const business = await getBusiness(auth.customer.id, id);
  if (!business) return errorJson("Business not found", 404);
  const body = await readJson<{ text?: string; skip?: boolean; skipRemaining?: boolean }>(
    request,
  );
  const updated = await continueBusinessOnboarding({
    business,
    text: body?.text ?? "",
    skip: Boolean(body?.skip),
    skipRemaining: Boolean(body?.skipRemaining),
    language: auth.customer.preferredLanguage,
  });
  return json({ business: updated });
}
