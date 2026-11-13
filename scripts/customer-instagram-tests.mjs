import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CUSTOMER_FORBIDDEN_PERMISSIONS,
  CUSTOMER_INSTAGRAM_PERMISSIONS,
  HOSTED_CUSTOMER_CALLBACK,
  buildCustomerAuthorizationUrl,
  customerInstagramAppReturnUrl,
  customerPermissionsSafe,
} from "../src/lib/instagram/customer-oauth.ts";
import { jsonContainsTokenLeak } from "../src/lib/instagram/oauth.ts";

const BASE = process.env.ADPILOT_URL ?? "http://127.0.0.1:3000";

async function api(method, path, { token, csrf, body } = {}) {
  const headers = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (csrf && method !== "GET" && method !== "HEAD") headers["x-csrf-token"] = csrf;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 240) };
  }
  return { status: response.status, data, text };
}

async function register(email, password, name) {
  const registered = await api("POST", "/api/auth/register", {
    body: { name, email, password, language: "en" },
  });
  if (registered.status >= 200 && registered.status < 300 && registered.data.token) return registered.data;
  const loggedIn = await api("POST", "/api/auth/login", { body: { email, password } });
  if ((loggedIn.status === 200 || loggedIn.status === 201) && loggedIn.data.token) return loggedIn.data;
  throw new Error(`auth ${email} failed`);
}

test("customer Instagram Login never requests publishing permissions", () => {
  assert.deepEqual([...CUSTOMER_INSTAGRAM_PERMISSIONS], [
    "instagram_business_basic",
    "instagram_business_manage_insights",
  ]);
  const url = new URL(
    buildCustomerAuthorizationUrl({
      clientId: "app",
      redirectUri: HOSTED_CUSTOMER_CALLBACK,
      state: "state",
    }),
  );
  assert.equal(url.hostname, "www.instagram.com");
  assert.equal(url.searchParams.get("scope")?.includes("publish"), false);
  for (const denied of CUSTOMER_FORBIDDEN_PERMISSIONS) {
    assert.equal(url.searchParams.get("scope")?.includes(denied), false);
  }
  assert.equal(customerPermissionsSafe(["instagram_business_basic"]), true);
  assert.equal(customerPermissionsSafe(["instagram_business_content_publish"]), false);
  assert.equal(HOSTED_CUSTOMER_CALLBACK.includes("/api/admin/instagram"), false);
  const app = new URL(customerInstagramAppReturnUrl({ status: "pending", businessId: "b", state: "s" }));
  assert.equal(app.host, "instagram-customer");
});

test("customer Instagram routes stay owned and cannot publish", async () => {
  const a = await register("customer-ig@adpilot.local", "CustomerPass123", "Customer");
  const b = await register("demo@adpilot.local", "DemoPass123", "Demo Owner");
  const started = await api("POST", "/api/businesses", { token: a.token, csrf: a.csrf, body: {} });
  assert.ok(started.status === 200 || started.status === 201);
  const businessId = started.data.business.id;
  const other = await api("POST", "/api/businesses", { token: b.token, csrf: b.csrf, body: {} });
  const otherId = other.data.business.id;

  const unauth = await api("GET", `/api/businesses/${businessId}/instagram`);
  assert.equal(unauth.status, 401);

  const cross = await api("GET", `/api/businesses/${businessId}/instagram`, {
    token: b.token,
    csrf: b.csrf,
  });
  assert.equal(cross.status, 404);

  const mine = await api("GET", `/api/businesses/${businessId}/instagram`, {
    token: a.token,
    csrf: a.csrf,
  });
  assert.equal(mine.status, 200);
  assert.equal(mine.data.instagram.canPublish, false);
  assert.equal(mine.data.instagram.login, "instagram");
  assert.deepEqual(jsonContainsTokenLeak(mine.data), []);
  assert.equal(JSON.stringify(mine.data).includes("token_ciphertext"), false);

  const publish = await api("POST", "/api/admin/instagram/publications/not-a-real-id", {
    token: a.token,
    csrf: a.csrf,
    body: { action: "publish" },
  });
  assert.ok(publish.status === 401 || publish.status === 403);

  const complete = await api("POST", `/api/businesses/${businessId}/instagram/complete`, {
    body: { state: "x" },
  });
  assert.equal(complete.status, 401);

  const analyze = await api("POST", `/api/businesses/${businessId}/instagram`, {
    token: a.token,
    csrf: a.csrf,
    body: { action: "analyze" },
  });
  assert.ok(analyze.status === 409 || analyze.status === 429);

  const stolen = "steal-customer-code";
  const callback = await api("GET", `/api/instagram/customer/callback?code=${stolen}&state=not-stored`);
  assert.equal(callback.status, 200);
  assert.match(callback.text, /adpilot:\/\/instagram-customer/);
  assert.equal(callback.text.includes(stolen), false);
  assert.equal(callback.text.includes("/admin/instagram"), false);

  const still = await api("GET", `/api/businesses/${otherId}/instagram`, { token: b.token, csrf: b.csrf });
  assert.equal(still.data.instagram.status === "connected", false);
});
