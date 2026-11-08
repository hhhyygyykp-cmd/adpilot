import { readSession } from "@/lib/auth";
import { CSRF_COOKIE } from "@/lib/http";
import { json } from "@/lib/http";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await readSession(request);
  const csrf = (await cookies()).get(CSRF_COOKIE)?.value ?? null;
  return json({
    customer: auth?.customer ?? null,
    csrf,
  });
}
