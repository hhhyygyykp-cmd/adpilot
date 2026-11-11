import assert from "node:assert/strict";
import { test } from "node:test";
import { encryptSecret, decryptSecret } from "../src/lib/crypto.ts";
import {
  HOSTED_CALLBACK,
  HOSTED_ORIGIN,
  REQUIRED_SECRET_NAMES,
  buildAuthorizationUrl,
  jsonContainsTokenLeak,
  missingMetaSecretsFrom,
  selectAgencyAccount,
} from "../src/lib/instagram/oauth.ts";

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
  return { status: response.status, data, location: response.headers.get("location"), text };
}

const sessions = new Map();

async function registerOrLogin(email, password, name) {
  if (sessions.has(email)) return sessions.get(email);
  const registered = await api("POST", "/api/auth/register", {
    body: { name, email, password, language: "en" },
  });
  if (registered.status >= 200 && registered.status < 300 && registered.data.token) {
    sessions.set(email, registered.data);
    return registered.data;
  }
  if (registered.status !== 409) {
    throw new Error(`register ${email} failed (${registered.status}): ${registered.data.error || ""}`);
  }
  const loggedIn = await api("POST", "/api/auth/login", { body: { email, password } });
  if ((loggedIn.status !== 200 && loggedIn.status !== 201) || !loggedIn.data.token) {
    throw new Error(`login ${email} failed (${loggedIn.status}): ${loggedIn.data.error || ""}`);
  }
  sessions.set(email, loggedIn.data);
  return loggedIn.data;
}

test("Unified Login callback and secret names are exact", () => {
  assert.equal(HOSTED_ORIGIN, "https://adpilot.apps.grok.bot");
  assert.equal(HOSTED_CALLBACK, "https://adpilot.apps.grok.bot/api/admin/instagram/callback");
  assert.deepEqual([...REQUIRED_SECRET_NAMES], [
    "META_APP_ID",
    "META_APP_SECRET",
    "META_CONFIGURATION_ID",
    "META_PUBLIC_ORIGIN",
  ]);
  assert.deepEqual(missingMetaSecretsFrom({}), [...REQUIRED_SECRET_NAMES]);
  assert.deepEqual(
    missingMetaSecretsFrom({
      META_APP_ID: "id",
      META_APP_SECRET: "secret",
      META_CONFIGURATION_ID: "config",
      META_PUBLIC_ORIGIN: "https://adpilot.apps.grok.bot",
    }),
    [],
  );
});

test("OAuth URL uses configuration_id and the hosted callback, not Instagram Login scopes", () => {
  const url = new URL(
    buildAuthorizationUrl({
      clientId: "dummy-app-id",
      configId: "dummy-config-id",
      redirectUri: HOSTED_CALLBACK,
      state: "dummy-state",
    }),
  );
  assert.equal(url.origin + url.pathname, "https://www.facebook.com/v22.0/dialog/oauth");
  assert.equal(url.searchParams.get("client_id"), "dummy-app-id");
  assert.equal(url.searchParams.get("config_id"), "dummy-config-id");
  assert.equal(url.searchParams.get("redirect_uri"), HOSTED_CALLBACK);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.has("scope"), false);
});

test("Agency account picker keeps Meta's real username", () => {
  assert.equal(selectAgencyAccount([]), null);
  const other = selectAgencyAccount([{ id: "1", username: "someone.else" }]);
  assert.equal(other?.username, "someone.else");
  const mixed = selectAgencyAccount([
    { id: "1", username: "someone.else" },
    { id: "2", username: "adpilot.ae" },
  ]);
  assert.equal(mixed?.username, "adpilot.ae");
});

test("Instagram tokens encrypt at rest and decrypt only with the app secret", () => {
  const secret = "unit-test-meta-app-secret";
  const token = "IGQW-not-a-real-token";
  const stored = encryptSecret(token, secret);
  assert.equal(stored.startsWith("v1:"), true);
  assert.equal(stored.includes(token), false);
  assert.equal(decryptSecret(stored, secret), token);
  assert.throws(() => decryptSecret(stored, "wrong-secret"));
});

test("auth: unauthenticated callers cannot use admin Instagram routes", async () => {
  const get = await api("GET", "/api/admin/instagram");
  assert.equal(get.status, 401);
  const connect = await api("POST", "/api/admin/instagram/connect", { body: {} });
  assert.equal(connect.status, 401);
  const publish = await api("POST", "/api/admin/instagram/publications/not-a-real-id", {
    body: { action: "publish" },
  });
  assert.equal(publish.status, 401);
});

test("authorization: customers cannot connect, inspect, or publish the agency account", async () => {
  const customer = await registerOrLogin(
    "customer-ig@adpilot.local",
    "CustomerPass123",
    "Customer",
  );
  assert.equal(customer.customer?.isAdmin, false);
  const get = await api("GET", "/api/admin/instagram", {
    token: customer.token,
    csrf: customer.csrf,
  });
  assert.equal(get.status, 403);
  const connect = await api("POST", "/api/admin/instagram/connect", {
    token: customer.token,
    csrf: customer.csrf,
    body: {},
  });
  assert.equal(connect.status, 403);
  const publish = await api("POST", "/api/admin/instagram/publications/not-a-real-id", {
    token: customer.token,
    csrf: customer.csrf,
    body: { action: "publish" },
  });
  assert.equal(publish.status, 403);
  const me = await api("GET", "/api/auth/me", { token: customer.token });
  assert.equal(me.status, 200);
  assert.deepEqual(jsonContainsTokenLeak(me.data), []);
  const serialized = JSON.stringify(me.data);
  assert.equal(serialized.includes("token_ciphertext"), false);
  assert.equal(serialized.includes("access_token"), false);
});

test("admin Instagram status never returns the access token", async () => {
  const admin = await registerOrLogin("demo@adpilot.local", "DemoPass123", "Demo Owner");
  assert.equal(admin.customer?.isAdmin, true);
  const get = await api("GET", "/api/admin/instagram", {
    token: admin.token,
    csrf: admin.csrf,
  });
  assert.equal(get.status, 200);
  const instagram = get.data.instagram;
  assert.ok(instagram);
  assert.equal(instagram.redirectUri, HOSTED_CALLBACK);
  assert.equal(instagram.login, "unified");
  assert.equal(instagram.username, null);
  assert.equal(instagram.status === "not_configured" || instagram.status === "disconnected", true);
  assert.deepEqual(jsonContainsTokenLeak(get.data), []);
  const serialized = JSON.stringify(get.data);
  assert.equal(serialized.includes("token_ciphertext"), false);
  assert.equal(/IGQW-|EAA[A-Za-z0-9]+/.test(serialized), false);
});

test("OAuth state validation rejects missing and unknown states", async () => {
  const admin = await registerOrLogin("demo@adpilot.local", "DemoPass123", "Demo Owner");
  const missing = await api("GET", "/api/admin/instagram/callback?code=fake-code", {
    token: admin.token,
  });
  assert.ok([302, 303, 307, 308].includes(missing.status));
  assert.ok(missing.location);
  const missingUrl = new URL(missing.location);
  assert.equal(missingUrl.origin + missingUrl.pathname, `${HOSTED_ORIGIN}/admin/settings`);
  assert.equal(missingUrl.searchParams.get("instagram"), "error");
  assert.match(missingUrl.searchParams.get("error") || "", /authorization code|expired|Connect/i);

  const unknown = await api(
    "GET",
    "/api/admin/instagram/callback?code=fake-code&state=not-a-stored-state",
    { token: admin.token },
  );
  assert.ok([302, 303, 307, 308].includes(unknown.status));
  const unknownUrl = new URL(unknown.location);
  assert.equal(unknownUrl.searchParams.get("instagram"), "error");
  assert.match(unknownUrl.searchParams.get("error") || "", /expired|Connect Instagram again/i);
});

test("Instagram media grants reject short unguessable tokens", async () => {
  const missing = await api("GET", "/api/instagram/media/short");
  assert.equal(missing.status, 404);
});

test("publishing permission checks refuse to post", async () => {
  const admin = await registerOrLogin("demo@adpilot.local", "DemoPass123", "Demo Owner");
  const graphCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("graph.facebook.com") || url.includes("graph.instagram.com")) {
      graphCalls.push(url.split("?")[0]);
      throw new Error("test refused to call Meta");
    }
    return originalFetch(input, init);
  };
  try {
    const result = await api("POST", "/api/admin/instagram/publications/00000000-0000-4000-8000-000000000001", {
      token: admin.token,
      csrf: admin.csrf,
      body: { action: "publish" },
    });
    assert.ok(result.status === 409 || result.status === 404);
    assert.equal(graphCalls.length, 0);
    assert.match(result.data.error || "", /not connected|authorized|not found|secrets/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
