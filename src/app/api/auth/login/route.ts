import { authenticate, createSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { errorJson, isBrowserRequest, json, readJson, sameOrigin, setLangCookie } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (isBrowserRequest(request) && !sameOrigin(request)) return errorJson("Forbidden origin", 403);
  const body = await readJson<{ email?: string; password?: string }>(request);
  const email = (body?.email ?? "").trim().toLowerCase();
  const limited = await rateLimit(clientKey(request, `login:${email}`), 8, 15 * 60 * 1000);
  if (!limited.ok) return errorJson("Too many attempts. Try again shortly.", 429);
  const customer = await authenticate(email, body?.password ?? "");
  if (!customer) return errorJson("Email or password is incorrect", 401);
  const session = await createSession(request, customer.id);
  await setLangCookie(request, customer.preferredLanguage);
  await audit({
    actorCustomerId: customer.id,
    action: "auth.login",
    entityType: "customer",
    entityId: customer.id,
  });
  return json({
    customer,
    ...(!isBrowserRequest(request) ? { token: session.token, csrf: session.csrf } : {}),
  });
}
