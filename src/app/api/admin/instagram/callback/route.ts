import { requireAdmin } from "@/lib/auth";
import { HOSTED_ORIGIN, hostedOrigin } from "@/lib/instagram/config";
import { completeInstagramOAuth } from "@/lib/instagram/connection";

export const dynamic = "force-dynamic";

function settingsUrl(request: Request) {
  const origin = hostedOrigin() || HOSTED_ORIGIN;
  try {
    return new URL("/admin/settings", `${origin}/`);
  } catch {
    return new URL("/admin/settings", request.url);
  }
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  const target = settingsUrl(request);
  if ("error" in auth && auth.error) {
    target.searchParams.set("instagram", "auth");
    target.searchParams.set(
      "error",
      "Sign in as an administrator on the hosted app, then click Connect Instagram.",
    );
    return Response.redirect(target);
  }
  const url = new URL(request.url);
  const result = await completeInstagramOAuth({
    request,
    adminCustomerId: auth.customer.id,
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    oauthError:
      url.searchParams.get("error") ||
      url.searchParams.get("error_reason") ||
      url.searchParams.get("error_message") ||
      url.searchParams.get("error_description"),
  });
  if ("error" in result) {
    target.searchParams.set("instagram", "error");
    target.searchParams.set("error", result.error);
    return Response.redirect(target);
  }
  target.searchParams.set("instagram", "connected");
  if (result.username) target.searchParams.set("username", result.username);
  return Response.redirect(target);
}
