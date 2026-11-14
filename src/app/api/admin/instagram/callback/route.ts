import { receiveInstagramOAuthCallback } from "@/lib/instagram/connection";
import { instagramAppReturnUrl } from "@/lib/instagram/oauth";

export const dynamic = "force-dynamic";

function appHandoff(input: {
  status: string;
  username?: string | null;
  error?: string | null;
  state?: string | null;
}) {
  return new Response(null, {
    status: 302,
    headers: {
      location: instagramAppReturnUrl(input),
      "cache-control": "private, no-store",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await receiveInstagramOAuthCallback({
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    oauthError:
      url.searchParams.get("error") ||
      url.searchParams.get("error_reason") ||
      url.searchParams.get("error_message") ||
      url.searchParams.get("error_description"),
  });
  if ("error" in result) {
    return appHandoff({ status: "error", error: result.error });
  }
  return appHandoff({ status: "pending", state: result.state });
}
