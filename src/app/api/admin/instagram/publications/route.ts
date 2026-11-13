import { requireAdmin } from "@/lib/auth";
import { json } from "@/lib/http";
import { getAgencyInstagramPublic } from "@/lib/instagram/connection";
import { listPublishingQueue } from "@/lib/instagram/publications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const instagram = await getAgencyInstagramPublic(request);
  return json({
    publications: await listPublishingQueue(),
    destination: {
      username: instagram.username,
      igUserId: instagram.igUserId,
      targetUsername: instagram.targetUsername,
    },
  });
}
