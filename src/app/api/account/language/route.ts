import { readSession } from "@/lib/auth";
import { safeEqual } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { errorJson, isBrowserRequest, json, readJson, sameOrigin, setLangCookie } from "@/lib/http";
import { isLanguage } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const browser = isBrowserRequest(request);
  if (browser && !sameOrigin(request)) return errorJson("Forbidden origin", 403);
  const body = await readJson<{ language?: string }>(request);
  if (!isLanguage(body?.language)) return errorJson("Unsupported language");
  const auth = await readSession(browser ? undefined : request);
  if (!browser && !auth) return errorJson("Please sign in", 401);
  if (auth) {
    const header = request.headers.get("x-csrf-token") ?? "";
    if (!header || !safeEqual(header, auth.session.csrf_token)) {
      return errorJson("Invalid security token", 403);
    }
    await sql(
      `update customers set preferred_language = $2, updated_at = now() where id = $1`,
      [auth.customer.id, body.language],
    );
  }
  await setLangCookie(request, body.language);
  return json({ language: body.language });
}
