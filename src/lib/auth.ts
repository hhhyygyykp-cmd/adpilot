import "server-only";

import { cookies } from "next/headers";
import { isAdminEmail } from "./admin";
import { audit } from "./audit";
import { hashPassword, newId, randomToken, safeEqual, sha256, verifyPassword } from "./crypto";
import { sql } from "./db";
import {
  cookieOptions,
  CSRF_COOKIE,
  errorJson,
  SESSION_COOKIE,
  sameOrigin,
} from "./http";
import type { Customer, Language } from "./types";

const SESSION_MS = 14 * 24 * 60 * 60 * 1000;

type CustomerRow = {
  id: string;
  email: string;
  name: string;
  preferred_language: Language;
  created_at: string;
};

type SessionRow = {
  id: string;
  customer_id: string;
  csrf_token: string;
  expires_at: string;
};

export async function mapCustomer(row: CustomerRow): Promise<Customer> {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    preferredLanguage: row.preferred_language,
    isAdmin: await isAdminEmail(row.email),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function createCustomer(input: {
  email: string;
  password: string;
  name: string;
  language: Language;
}) {
  const id = newId();
  const passwordHash = await hashPassword(input.password);
  const rows = await sql<CustomerRow>(
    `insert into customers (id, email, password_hash, name, preferred_language)
     values ($1, $2, $3, $4, $5)
     returning id, email, name, preferred_language, created_at`,
    [id, input.email.toLowerCase(), passwordHash, input.name, input.language],
  );
  return mapCustomer(rows[0]);
}

export async function findCustomerByEmail(email: string) {
  const rows = await sql<CustomerRow & { password_hash: string }>(
    `select id, email, name, preferred_language, created_at, password_hash
     from customers where lower(email) = lower($1) limit 1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function authenticate(email: string, password: string) {
  const row = await findCustomerByEmail(email);
  if (!row) return null;
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return null;
  return mapCustomer(row);
}

export function isIosClient(request: Request): boolean {
  return request.headers.get("x-adpilot-client") === "ios";
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(header.trim());
  return match?.[1] ?? null;
}

export async function createSession(request: Request, customerId: string) {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const id = newId();
  await sql(
    `insert into sessions (id, customer_id, token_hash, csrf_token, expires_at)
     values ($1, $2, $3, $4, $5)`,
    [id, customerId, sha256(token), csrf, new Date(Date.now() + SESSION_MS).toISOString()],
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(request, true));
  store.set(CSRF_COOKIE, csrf, cookieOptions(request, false));
  return { token, csrf };
}

export async function destroySession(request: Request) {
  const store = await cookies();
  const token = bearerToken(request) ?? store.get(SESSION_COOKIE)?.value;
  if (token) {
    await sql(`delete from sessions where token_hash = $1`, [sha256(token)]);
  }
  store.set(SESSION_COOKIE, "", { ...cookieOptions(request, true), maxAge: 0 });
  store.set(CSRF_COOKIE, "", { ...cookieOptions(request, false), maxAge: 0 });
}

async function readSessionByToken(token: string): Promise<{
  session: SessionRow;
  customer: Customer;
} | null> {
  const rows = await sql<SessionRow & CustomerRow>(
    `select s.id, s.customer_id, s.csrf_token, s.expires_at,
            c.email, c.name, c.preferred_language, c.created_at
     from sessions s
     join customers c on c.id = s.customer_id
     where s.token_hash = $1
     limit 1`,
    [sha256(token)],
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await sql(`delete from sessions where id = $1`, [row.id]);
    return null;
  }
  return {
    session: {
      id: row.id,
      customer_id: row.customer_id,
      csrf_token: row.csrf_token,
      expires_at: row.expires_at,
    },
    customer: await mapCustomer({
      id: row.customer_id,
      email: row.email,
      name: row.name,
      preferred_language: row.preferred_language,
      created_at: row.created_at,
    }),
  };
}

export async function readSession(request?: Request): Promise<{
  session: SessionRow;
  customer: Customer;
} | null> {
  if (request) {
    const token = bearerToken(request);
    if (token) return readSessionByToken(token);
  }
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionByToken(token);
}

export async function requireCustomer(request: Request) {
  if (bearerToken(request)) {
    const auth = await readSession(request);
    if (!auth) return { error: errorJson("Please sign in", 401) as Response };
    return { customer: auth.customer, session: auth.session };
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    if (!sameOrigin(request)) {
      return { error: errorJson("Forbidden origin", 403) as Response };
    }
    const auth = await readSession();
    if (!auth) return { error: errorJson("Please sign in", 401) as Response };
    const header = request.headers.get("x-csrf-token") ?? "";
    if (!header || !safeEqual(header, auth.session.csrf_token)) {
      return { error: errorJson("Invalid security token", 403) as Response };
    }
    return { customer: auth.customer, session: auth.session };
  }
  const auth = await readSession();
  if (!auth) return { error: errorJson("Please sign in", 401) as Response };
  return { customer: auth.customer, session: auth.session };
}

export async function requireAdmin(request: Request) {
  const result = await requireCustomer(request);
  if ("error" in result && result.error) return result;
  if (!result.customer.isAdmin) {
    await audit({
      actorCustomerId: result.customer.id,
      action: "admin.denied",
      entityType: "admin",
      metadata: { path: new URL(request.url).pathname },
    });
    return { error: errorJson("Administrator access required", 403) as Response };
  }
  return result;
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function validPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 200;
}

export async function updatePassword(customerId: string, current: string, next: string) {
  const rows = await sql<{ password_hash: string }>(
    `select password_hash from customers where id = $1`,
    [customerId],
  );
  const row = rows[0];
  if (!row) return false;
  if (!(await verifyPassword(current, row.password_hash))) return false;
  await sql(`update customers set password_hash = $1, updated_at = now() where id = $2`, [
    await hashPassword(next),
    customerId,
  ]);
  return true;
}
