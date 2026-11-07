import { requireAdmin } from "@/lib/auth";
import { newId, randomToken, sha256 } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { errorJson, json, readJson } from "@/lib/http";
import { validEmail } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const body = await readJson<{ email?: string }>(request);
  const email = (body?.email ?? "").trim().toLowerCase();
  if (!validEmail(email)) return errorJson("Enter a valid email");
  const token = randomToken(24);
  const id = newId();
  await sql(
    `insert into admin_invites (id, email, token_hash, expires_at, created_by)
     values ($1, $2, $3, $4, $5)`,
    [
      id,
      email,
      sha256(token),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      auth.customer.id,
    ],
  );
  await audit({
    actorCustomerId: auth.customer.id,
    action: "admin.invite",
    entityType: "admin_invite",
    entityId: id,
    metadata: { email },
  });
  const origin = new URL(request.url).origin;
  return json({
    invite: {
      id,
      email,
      url: `${origin}/register?invite=${token}&email=${encodeURIComponent(email)}`,
    },
  });
}
