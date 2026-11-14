import { receiveCustomerInstagramCallback } from "@/lib/instagram/customer";
import { customerInstagramAppReturnUrl } from "@/lib/instagram/customer-oauth";

export const dynamic = "force-dynamic";

function handoff(input: {
  status: string;
  businessId?: string;
  state?: string;
  error?: string;
}) {
  return new Response(null, {
    status: 302,
    headers: {
      location: customerInstagramAppReturnUrl(input),
      "cache-control": "private, no-store",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await receiveCustomerInstagramCallback({
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    oauthError:
      url.searchParams.get("error") ||
      url.searchParams.get("error_reason") ||
      url.searchParams.get("error_message") ||
      url.searchParams.get("error_description"),
  });
  if ("error" in result) {
    return handoff({ status: "error", error: result.error, businessId: result.businessId });
  }
  return handoff({ status: "pending", state: result.state, businessId: result.businessId });
}
