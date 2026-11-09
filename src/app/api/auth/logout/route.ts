import { bearerToken, destroySession, readSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { safeEqual } from "@/lib/crypto";
import { errorJson, isBrowserRequest, json, sameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const browser = isBrowserRequest(request);
  if (browser && !sameOrigin(request)) return errorJson("Forbidden origin", 403);
  if (!browser && !bearerToken(request)) return errorJson("Please sign in", 401);
  const auth = await readSession(browser ? undefined : request);
  if (auth) {
    const header = request.headers.get("x-csrf-token") ?? "";
    if (!header || !safeEqual(header, auth.session.csrf_token)) {
      return errorJson("Invalid security token", 403);
    }
  }
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
