import { requireAdmin } from "@/lib/auth";
import { errorJson, json, readJson } from "@/lib/http";
import {
  disconnectInstagram,
  getAgencyInstagramPublic,
  refreshInstagramConnection,
} from "@/lib/instagram/connection";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  return json({ instagram: await getAgencyInstagramPublic(request) });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const body = await readJson<{ action?: string }>(request);
  const action = body?.action;
  if (action === "disconnect") {
    await disconnectInstagram(auth.customer.id);
    return json({ instagram: await getAgencyInstagramPublic(request) });
  }
  if (action === "refresh") {
    const result = await refreshInstagramConnection(auth.customer.id);
    if ("error" in result) return errorJson(result.error, result.status);
    return json({ instagram: await getAgencyInstagramPublic(request) });
  }
  return errorJson("Unknown action", 400);
}
