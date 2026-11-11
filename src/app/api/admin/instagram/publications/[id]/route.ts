import { requireAdmin } from "@/lib/auth";
import { errorJson, json, readJson } from "@/lib/http";
import {
  authorizePublication,
  declinePublication,
  getPublicationRow,
  mapPublication,
  refreshPublicationInsights,
  revokeAuthorization,
} from "@/lib/instagram/publications";
import { publishAuthorizedAd } from "@/lib/instagram/publish";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const row = await getPublicationRow(id);
  if (!row) return errorJson("Publication not found", 404);
  return json({ publication: mapPublication(row) });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const body = await readJson<{ action?: string; caption?: string }>(request);
  const action = body?.action;
  if (action === "authorize") {
    const result = await authorizePublication({
      adminCustomerId: auth.customer.id,
      publicationId: id,
      caption: body?.caption,
    });
    if ("error" in result) return errorJson(result.error, result.status);
    return json({ publication: result });
  }
  if (action === "revoke") {
    const result = await revokeAuthorization({
      adminCustomerId: auth.customer.id,
      publicationId: id,
    });
    if ("error" in result) return errorJson(result.error, result.status);
    return json({ publication: result });
  }
  if (action === "decline") {
    const result = await declinePublication({
      adminCustomerId: auth.customer.id,
      publicationId: id,
    });
    if ("error" in result) return errorJson(result.error, result.status);
    return json({ publication: result });
  }
  if (action === "insights") {
    const row = await getPublicationRow(id);
    if (!row) return errorJson("Publication not found", 404);
    const result = await refreshPublicationInsights(mapPublication(row));
    if (!result) return errorJson("Publication not found", 404);
    return json({ publication: result });
  }
  if (action === "publish") {
    const limited = rateLimit(clientKey(request, `ig-publish:${auth.customer.id}`), 20, 60 * 60 * 1000);
    if (!limited.ok) return errorJson("Too many publish attempts. Try again shortly.", 429);
    const result = await publishAuthorizedAd({
      request,
      adminCustomerId: auth.customer.id,
      publicationId: id,
    });
    if ("error" in result) return errorJson(result.error, result.status);
    return json({ publication: result });
  }
  return errorJson("Unknown action", 400);
}
