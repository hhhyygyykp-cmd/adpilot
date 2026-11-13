import { requireCustomer } from "@/lib/auth";
import { errorJson, json, readJson } from "@/lib/http";
import {
  analyzeCustomerInstagram,
  confirmCustomerAnalysis,
  disconnectCustomerInstagram,
  getCustomerInstagramPublic,
  getLatestAnalysis,
  type InferredInsights,
} from "@/lib/instagram/customer";
import { getBusiness } from "@/lib/queries/businesses";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const business = await getBusiness(auth.customer.id, id);
  if (!business) return errorJson("Business not found", 404);
  return json({
    instagram: await getCustomerInstagramPublic(auth.customer.id, id),
    analysis: await getLatestAnalysis(auth.customer.id, id),
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const business = await getBusiness(auth.customer.id, id);
  if (!business) return errorJson("Business not found", 404);
  const body = await readJson<{
    action?: string;
    analysisId?: string;
    inferred?: Partial<InferredInsights>;
  }>(request);
  const action = body?.action;
  if (action === "disconnect" || action === "delete_imported") {
    await disconnectCustomerInstagram({
      customerId: auth.customer.id,
      businessId: id,
      deleteImported: true,
    });
    return json({
      instagram: await getCustomerInstagramPublic(auth.customer.id, id),
      analysis: await getLatestAnalysis(auth.customer.id, id),
    });
  }
  if (action === "analyze") {
    const limited = await rateLimit(clientKey(request, `ig-customer-analyze:${id}`), 4, 60 * 60 * 1000);
    if (!limited.ok) return errorJson("Wait before analyzing again.", 429);
    const result = await analyzeCustomerInstagram({
      customerId: auth.customer.id,
      businessId: id,
    });
    if ("error" in result) return errorJson(result.error, result.status);
    return json({
      instagram: await getCustomerInstagramPublic(auth.customer.id, id),
      analysis: result.analysis,
    });
  }
  if (action === "confirm") {
    if (!body?.analysisId) return errorJson("Review the findings first.");
    const result = await confirmCustomerAnalysis({
      customerId: auth.customer.id,
      businessId: id,
      analysisId: body.analysisId,
      inferred: body.inferred ?? {},
    });
    if ("error" in result) return errorJson(result.error, result.status);
    return json({
      instagram: await getCustomerInstagramPublic(auth.customer.id, id),
      analysis: result.analysis,
      business: result.business,
    });
  }
  return errorJson("Unknown action", 400);
}
