import { receiveCustomerInstagramCallback } from "@/lib/instagram/customer";
import { HOSTED_ORIGIN } from "@/lib/instagram/oauth";
import { customerInstagramAppReturnUrl } from "@/lib/instagram/customer-oauth";

export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function handoff(input: {
  status: string;
  businessId?: string;
  state?: string;
  error?: string;
}) {
  const href = customerInstagramAppReturnUrl(input);
  const web =
    input.businessId && input.state
      ? `${HOSTED_ORIGIN}/business/${encodeURIComponent(input.businessId)}?instagram=pending&state=${encodeURIComponent(input.state)}`
      : "";
  const message =
    input.error?.trim() ||
    "Instagram login finished. Returning to AdPilot to complete linking. AdPilot will not post from this account.";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>AdPilot</title>
</head>
<body style="font-family:system-ui,sans-serif;background:#140f1c;color:#fffef8;padding:32px;line-height:1.5">
  <p>${escapeHtml(message)}</p>
  <p><a href="${escapeHtml(href)}" style="color:#e6c27a">Open AdPilot</a></p>
  ${web ? `<p><a href="${escapeHtml(web)}" style="color:#e6c27a">Continue in the browser</a></p>` : ""}
  <script>location.replace(${JSON.stringify(href)});</script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
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
