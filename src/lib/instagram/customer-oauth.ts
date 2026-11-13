export const HOSTED_ORIGIN = "https://adpilot.apps.grok.bot";

export const INSTAGRAM_LOGIN_HOST = "https://www.instagram.com";
export const INSTAGRAM_TOKEN_HOST = "https://api.instagram.com";
export const INSTAGRAM_GRAPH_HOST = "https://graph.instagram.com";
export const INSTAGRAM_GRAPH_VERSION = "v22.0";
export const CUSTOMER_CALLBACK_PATH = "/api/instagram/customer/callback";
export const HOSTED_CUSTOMER_CALLBACK = `${HOSTED_ORIGIN}${CUSTOMER_CALLBACK_PATH}`;
export const APP_CUSTOMER_HOST = "instagram-customer";

export const CUSTOMER_INSTAGRAM_PERMISSIONS = [
  "instagram_business_basic",
  "instagram_business_manage_insights",
] as const;

export const CUSTOMER_FORBIDDEN_PERMISSIONS = [
  "instagram_content_publish",
  "instagram_business_content_publish",
  "pages_manage_posts",
  "publish_video",
] as const;

export function customerInstagramRedirectUri(): string {
  return HOSTED_CUSTOMER_CALLBACK;
}

export function buildCustomerAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(`${INSTAGRAM_LOGIN_HOST}/oauth/authorize`);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", CUSTOMER_INSTAGRAM_PERMISSIONS.join(","));
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function customerInstagramAppReturnUrl(input: {
  status: string;
  businessId?: string | null;
  state?: string | null;
  error?: string | null;
  username?: string | null;
}): string {
  const url = new URL(`adpilot://${APP_CUSTOMER_HOST}`);
  url.searchParams.set("instagram", input.status);
  if (input.businessId?.trim()) url.searchParams.set("business", input.businessId.trim());
  if (input.state?.trim()) url.searchParams.set("state", input.state.trim().slice(0, 128));
  if (input.username?.trim()) url.searchParams.set("username", input.username.trim().replace(/^@/, ""));
  if (input.error?.trim()) url.searchParams.set("error", input.error.trim().slice(0, 180));
  return url.toString();
}

export function customerPermissionsSafe(permissions: string[]): boolean {
  const granted = permissions.map((item) => item.toLowerCase());
  return !CUSTOMER_FORBIDDEN_PERMISSIONS.some((denied) => granted.includes(denied));
}

export function instagramGraphUrl(path: string): string {
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  if (trimmed.startsWith("/oauth") || trimmed === "/access_token" || trimmed === "/refresh_access_token") {
    return `${INSTAGRAM_GRAPH_HOST}${trimmed}`;
  }
  return `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_GRAPH_VERSION}${trimmed}`;
}
