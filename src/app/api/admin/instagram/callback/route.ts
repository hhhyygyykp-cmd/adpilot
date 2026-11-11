import { requireAdmin } from "@/lib/auth";
import { completeInstagramOAuth } from "@/lib/instagram/connection";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  const target = new URL("/admin/settings", request.url);
  if ("error" in auth && auth.error) {
    target.searchParams.set("instagram", "auth");
    target.searchParams.set("error", "Sign in as an administrator to finish connecting Instagram.");
    return Response.redirect(target);
  }
  const url = new URL(request.url);
  const result = await completeInstagramOAuth({
    request,
    adminCustomerId: auth.customer.id,
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    oauthError: url.searchParams.get("error"),
  });
  if ("error" in result) {
    target.searchParams.set("instagram", "error");
    target.searchParams.set("error", result.error);
    return Response.redirect(target);
  }
  target.searchParams.set("instagram", "connected");
  return Response.redirect(target);
}
