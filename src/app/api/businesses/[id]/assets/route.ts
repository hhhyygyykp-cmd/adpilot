import { requireCustomer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { errorJson, json } from "@/lib/http";
import { getBusiness, insertAsset, listAssets } from "@/lib/queries/businesses";
import { MAX_UPLOAD_BYTES, saveUpload, sniffImageMime } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const business = await getBusiness(auth.customer.id, id);
  if (!business) return errorJson("Business not found", 404);
  return json({ assets: await listAssets(auth.customer.id, id) });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const business = await getBusiness(auth.customer.id, id);
  if (!business) return errorJson("Business not found", 404);
  const form = await request.formData();
  const kindRaw = String(form.get("kind") ?? "");
  const kind = kindRaw === "logo" ? "logo" : kindRaw === "product_photo" ? "product_photo" : null;
  if (!kind) return errorJson("Choose logo or product photo");
  const file = form.get("file");
  if (!(file instanceof File)) return errorJson("Choose a file");
  if (file.size > MAX_UPLOAD_BYTES) return errorJson("File is larger than 8 MB");
  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImageMime(buffer);
  if (!sniffed) return errorJson("Upload a JPEG, PNG, WEBP, or GIF image");
  const saved = await saveUpload({
    customerId: auth.customer.id,
    buffer,
    mimeType: sniffed,
  });
  const assetId = await insertAsset({
    customerId: auth.customer.id,
    businessId: id,
    kind,
    originalName: file.name || "upload",
    mimeType: saved.mimeType,
    byteSize: buffer.byteLength,
    storageKey: saved.storageKey,
  });
  await audit({
    actorCustomerId: auth.customer.id,
    action: "asset.upload",
    entityType: "business_asset",
    entityId: assetId,
    metadata: { kind, businessId: id },
  });
  return json({ assetId, assets: await listAssets(auth.customer.id, id) }, 201);
}
