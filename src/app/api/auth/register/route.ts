import { findValidInvite, redeemInvite } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { createCustomer, createSession, findCustomerByEmail, validEmail, validPassword } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { errorJson, isBrowserRequest, json, readJson, sameOrigin, setLangCookie } from "@/lib/http";
import { isLanguage } from "@/lib/i18n";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (isBrowserRequest(request) && !sameOrigin(request)) return errorJson("Forbidden origin", 403);
  const ipHour = await rateLimit(clientKey(request, "register:hour"), 3, 60 * 60 * 1000);
  const ipDay = await rateLimit(clientKey(request, "register:day"), 8, 24 * 60 * 60 * 1000);
  const globalDay = await rateLimit("register:global:day", 20, 24 * 60 * 60 * 1000);
  if (!ipHour.ok || !ipDay.ok || !globalDay.ok) {
    return errorJson("Too many accounts created from this network. Try again later.", 429);
  }
  const body = await readJson<{
    email?: string;
    password?: string;
    name?: string;
    language?: string;
    inviteToken?: string;
  }>(request);
  if (!body) return errorJson("Invalid request");
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim();
  const language = isLanguage(body.language) ? body.language : "en";
  if (!validEmail(email)) return errorJson("Enter a valid email");
  if (!validPassword(password)) return errorJson("Password must be at least 8 characters");
  if (name.length < 2 || name.length > 80) return errorJson("Enter your name");
  if (await findCustomerByEmail(email)) return errorJson("An account with this email already exists", 409);

  let inviteId: string | null = null;
  if (body.inviteToken) {
    const invite = await findValidInvite(email, sha256(body.inviteToken));
    if (!invite) return errorJson("This invitation is invalid or expired", 400);
    inviteId = invite.id;
  }

  const customer = await createCustomer({ email, password, name, language });
  if (inviteId) await redeemInvite(inviteId);
  const session = await createSession(request, customer.id);
  await setLangCookie(request, language);
  await audit({
    actorCustomerId: customer.id,
    action: "auth.register",
    entityType: "customer",
    entityId: customer.id,
    metadata: { invited: Boolean(inviteId) },
  });
  return json(
    {
      customer,
      ...(!isBrowserRequest(request) ? { token: session.token, csrf: session.csrf } : {}),
    },
    201,
  );
}
