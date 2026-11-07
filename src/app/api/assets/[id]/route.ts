import { requireCustomer } from "@/lib/auth";
import { errorJson } from "@/lib/http";
import { deleteAsset, getOwnedAsset } from "@/lib/queries/businesses";
import { readUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const asset = await getOwnedAsset(auth.customer.id, id, auth.customer.isAdmin);
  if (!asset) return errorJson("File not found", 404);
  try {
    const buffer = await readUpload(asset.storage_key);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": asset.mime_type,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        "content-disposition": `inline; filename="${asset.original_name.replace(/"/g, "")}"`,
      },
    });
  } catch {
    return errorJson("File not found", 404);
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const deleted = await deleteAsset(auth.customer.id, id);
  if (!deleted) return errorJson("File not found", 404);
  return new Response(null, { status: 204 });
}
