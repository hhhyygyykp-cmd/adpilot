import { requireAdmin } from "@/lib/auth";
import { json } from "@/lib/http";
import { listPublishingQueue } from "@/lib/instagram/publications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  return json({ publications: await listPublishingQueue() });
}
