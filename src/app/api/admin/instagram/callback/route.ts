import { receiveInstagramOAuthCallback } from "@/lib/instagram/connection";
import { instagramAppReturnUrl } from "@/lib/instagram/oauth";

export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appHandoff(input: {
  status: string;
  username?: string | null;
  error?: string | null;
  state?: string | null;
}) {
  const href = instagramAppReturnUrl(input);
  const message =
    input.error?.trim() ||
    (input.status === "pending"
      ? "Instagram login finished. Returning to the AdPilot app to complete linking."
      : "Return to the AdPilot app to finish Instagram linking.");
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
  <script>location.replace(${JSON.stringify(href)});</script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
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
