const FACEBOOK_OAUTH_DIALOG = "https://www.facebook.com/v22.0/dialog/oauth";
const HOSTED_ORIGIN = "https://adpilot.apps.grok.bot";

export const CUSTOMER_CALLBACK_PATH = "/api/instagram/customer/callback";
export const HOSTED_CUSTOMER_CALLBACK = `${HOSTED_ORIGIN}${CUSTOMER_CALLBACK_PATH}`;
export const APP_CUSTOMER_HOST = "instagram-customer";
export const META_CUSTOMER_CONFIGURATION_ID_NAME = "META_CUSTOMER_CONFIGURATION_ID";

/** Unified Login permissions for customer analysis. Never include publishing. */
export const CUSTOMER_UNIFIED_PERMISSIONS = [
  "instagram_basic",
  "instagram_manage_insights",
] as const;

export const CUSTOMER_INSTAGRAM_PERMISSIONS = CUSTOMER_UNIFIED_PERMISSIONS;

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
  configId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(FACEBOOK_OAUTH_DIALOG);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("config_id", input.configId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("override_default_response_type", "true");
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
