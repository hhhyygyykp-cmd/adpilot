import { errorJson } from "@/lib/http";
import { readGrantedCreative } from "@/lib/instagram/media-grant";
import { readUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const granted = await readGrantedCreative(token);
  if (!granted) return errorJson("This media link expired or is invalid.", 404);
  try {
    const buffer = await readUpload(granted.storage_key);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": granted.mime_type,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-disposition": `inline; filename="${granted.original_name.replace(/[\r\n"]/g, "")}"`,
      },
    });
  } catch {
    return errorJson("File not found", 404);
  }
}
