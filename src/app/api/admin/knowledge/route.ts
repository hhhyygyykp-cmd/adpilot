import { requireAdmin } from "@/lib/auth";
import { FRAMEWORKS } from "@/lib/agent/knowledge";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  return json({
    frameworks: FRAMEWORKS,
    note: "Chosen by context against verified facts. Never applied as a default template.",
  });
}
