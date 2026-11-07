import { requireCustomer, validPassword } from "@/lib/auth";
import { sql } from "@/lib/db";
import { errorJson, json, readJson, setLangCookie } from "@/lib/http";
import { isLanguage } from "@/lib/i18n";
import { updatePassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const body = await readJson<{
    name?: string;
    language?: string;
    currentPassword?: string;
    newPassword?: string;
  }>(request);
  if (!body) return errorJson("Invalid request");

  if (body.newPassword) {
    if (!validPassword(body.newPassword)) return errorJson("New password must be at least 8 characters");
    const ok = await updatePassword(
      auth.customer.id,
      body.currentPassword ?? "",
      body.newPassword,
    );
    if (!ok) return errorJson("Current password is incorrect", 403);
  }

  const name = body.name?.trim();
  const language = isLanguage(body.language) ? body.language : null;
  if (name && (name.length < 2 || name.length > 80)) return errorJson("Enter your name");
  await sql(
    `update customers set
       name = coalesce($2, name),
       preferred_language = coalesce($3, preferred_language),
       updated_at = now()
     where id = $1`,
    [auth.customer.id, name || null, language],
  );
  if (language) await setLangCookie(request, language);
  return json({
    customer: {
      ...auth.customer,
      name: name || auth.customer.name,
      preferredLanguage: language || auth.customer.preferredLanguage,
    },
  });
}
