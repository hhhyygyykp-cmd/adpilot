import { bearerToken, destroySession, isIosClient, readSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { errorJson, json, sameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request) && !isIosClient(request) && !bearerToken(request)) {
    return errorJson("Forbidden origin", 403);
  }
  const auth = await readSession(request);
  await destroySession(request);
  if (auth) {
    await audit({
      actorCustomerId: auth.customer.id,
      action: "auth.logout",
      entityType: "customer",
      entityId: auth.customer.id,
    });
  }
  return json({ ok: true });
}
