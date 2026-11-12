import type { InstagramAccount } from "./oauth";

/** IG User fields documented for graph.facebook.com (Instagram API with Facebook Login / Unified Login). */
export const IG_USER_GRAPH_FIELDS = ["id", "username", "name"] as const;

/**
 * Fields that exist on graph.instagram.com User objects (Instagram Login) and must
 * never be requested on graph.facebook.com IG User, Facebook User, or Business nodes.
 */
export const INSTAGRAM_LOGIN_ONLY_FIELDS = ["account_type", "user_id"] as const;

export function igUserProfileFields(extra: string[] = []): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const field of [...IG_USER_GRAPH_FIELDS, ...extra]) {
    if ((INSTAGRAM_LOGIN_ONLY_FIELDS as readonly string[]).includes(field)) continue;
    if (seen.has(field)) continue;
    seen.add(field);
    out.push(field);
  }
  return out.join(",");
}

export function withoutGraphField(fields: string, field: string): string {
  return fields
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && item !== field)
    .join(",");
}

export function nonexistingFieldFromGraphError(message: string): string | null {
  const match = message.match(/nonexisting field \(([^)]+)\)/i);
  return match?.[1]?.trim() || null;
}

export type IgUserProfile = {
  id: string;
  username: string;
  name: string;
};

export function parseIgUserNode(
  body: { id?: unknown; username?: unknown; name?: unknown; ig_id?: unknown; user_id?: unknown },
  fallbackId: string,
): IgUserProfile {
  // Graph IG User `id` is the professional account id used on graph.facebook.com.
  // Do not substitute Instagram Login `user_id` or legacy `ig_id` for Graph paths.
  const id = String(body.id || fallbackId);
  return {
    id,
    username: typeof body.username === "string" ? body.username.trim() : "",
    name: typeof body.name === "string" ? body.name.trim() : "",
  };
}

export async function readIgUserProfile(input: {
  igUserId: string;
  get: (path: string, fields: string) => Promise<Record<string, unknown>>;
  fields?: string;
}): Promise<IgUserProfile> {
  if (!input.igUserId || input.igUserId === "me") {
    throw new Error("Instagram professional account id is missing.");
  }
  let fields = input.fields ?? igUserProfileFields();
  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const body = await input.get(`/${input.igUserId}`, fields);
      return parseIgUserNode(body, input.igUserId);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const badField = nonexistingFieldFromGraphError(message);
      if (!badField) break;
      const next = withoutGraphField(fields, badField);
      if (!next || next === fields) break;
      fields = next;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Instagram profile request failed.");
}

type AssignedRow = { id?: string; username?: string };
type PageRow = {
  id?: string;
  instagram_business_account?: { id?: string; username?: string };
};
type MeRow = {
  id?: string;
  client_business_id?: string;
  instagram_business_account?: { id?: string; username?: string };
};

export function collectDiscoveredInstagramAccounts(input: {
  assigned?: AssignedRow[];
  pages?: PageRow[];
  me?: MeRow | null;
}): InstagramAccount[] {
  const facebookUserId = input.me?.id ? String(input.me.id) : "";
  const portfolioId = input.me?.client_business_id ? String(input.me.client_business_id) : "";
  const byId = new Map<string, InstagramAccount>();

  const collect = (id?: string, username?: string) => {
    if (!id) return;
    if (id === facebookUserId || id === portfolioId) return;
    const name = username?.trim() || "";
    const existing = byId.get(id);
    if (!existing) byId.set(id, { id, username: name });
    else if (!existing.username && name) existing.username = name;
  };

  for (const row of input.assigned ?? []) collect(row.id, row.username);
  for (const row of input.pages ?? []) {
    collect(row.instagram_business_account?.id, row.instagram_business_account?.username);
  }
  collect(
    input.me?.instagram_business_account?.id,
    input.me?.instagram_business_account?.username,
  );
  return [...byId.values()];
}
