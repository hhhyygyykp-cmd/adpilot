import { requireCustomer } from "@/lib/auth";
import { errorJson } from "@/lib/http";
import { getOwnedCreative } from "@/lib/queries/creatives";
import { readUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const asset = await getOwnedCreative(auth.customer.id, id, auth.customer.isAdmin);
  if (!asset) return errorJson("File not found", 404);
  try {
    const buffer = await readUpload(asset.storage_key);
    const download = new URL(request.url).searchParams.get("download");
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": asset.mime_type,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        "content-disposition": `${download ? "attachment" : "inline"}; filename="${asset.original_name.replace(/"/g, "")}"`,
      },
    });
  } catch {
    return errorJson("File not found", 404);
  }
}
