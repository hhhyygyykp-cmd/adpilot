export const FACEBOOK_GRAPH_VERSION = "v22.0";
export const FACEBOOK_GRAPH_HOST = "https://graph.facebook.com";
export const FACEBOOK_OAUTH_DIALOG = `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`;
export const HOSTED_ORIGIN = "https://adpilot.apps.grok.bot";
export const HOSTED_CALLBACK = `${HOSTED_ORIGIN}/api/admin/instagram/callback`;
export const TARGET_INSTAGRAM_USERNAME = "adpilot.ae";

export const UNIFIED_PERMISSIONS = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
] as const;

export const META_APP_ID_NAME = "META_APP_ID";
export const META_APP_SECRET_NAME = "META_APP_SECRET";
export const META_CONFIGURATION_ID_NAME = "META_CONFIGURATION_ID";
export const META_PUBLIC_ORIGIN_NAME = "META_PUBLIC_ORIGIN";

export const REQUIRED_SECRET_NAMES = [
  META_APP_ID_NAME,
  META_APP_SECRET_NAME,
  META_CONFIGURATION_ID_NAME,
  META_PUBLIC_ORIGIN_NAME,
] as const;

export const TOKEN_LEAK_KEYS = [
  "token",
  "accessToken",
  "access_token",
  "token_ciphertext",
  "client_secret",
  "app_secret",
  "refresh_token",
  "ig_refresh_token",
];

export function normalizeInstagramUsername(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^@/, "").toLowerCase();
}

export function missingMetaSecretsFrom(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const missing: string[] = [];
  if (!(env.META_APP_ID ?? "").trim()) missing.push(META_APP_ID_NAME);
  if (!(env.META_APP_SECRET ?? "").trim()) missing.push(META_APP_SECRET_NAME);
  if (!(env.META_CONFIGURATION_ID ?? "").trim()) missing.push(META_CONFIGURATION_ID_NAME);
  if (!(env.META_PUBLIC_ORIGIN ?? "").trim()) missing.push(META_PUBLIC_ORIGIN_NAME);
  return missing;
}

export function buildAuthorizationUrl(input: {
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

export type InstagramAccount = {
  id: string;
  username: string;
};

export function selectAgencyAccount(accounts: InstagramAccount[]): InstagramAccount | null {
  if (accounts.length === 0) return null;
  const preferred = accounts.find(
    (item) => normalizeInstagramUsername(item.username) === TARGET_INSTAGRAM_USERNAME,
  );
  return preferred ?? accounts[0];
}

export function jsonContainsTokenLeak(value: unknown): string[] {
  const found: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    for (const [key, nested] of Object.entries(node as Record<string, unknown>)) {
      if (TOKEN_LEAK_KEYS.includes(key)) found.push(key);
      visit(nested);
    }
  };
  visit(value);
  return [...new Set(found)];
}
