import assert from "node:assert/strict";
import { test } from "node:test";
import { providerFailureReport } from "../src/lib/media/fal-key.ts";
import { chatCannotAuthorizePaid, paidConsentDecision } from "../src/lib/media/paid-consent.ts";

const quote = 0.004;

test("a model approved flag cannot authorize paid image or video generation", () => {
  for (const args of [{ approved: true }, { approved: "true" }, { approved: 1 }, {}, { approved: false }]) {
    const decision = chatCannotAuthorizePaid(args);
    assert.equal(decision.ok, false);
    assert.match(decision.error, /cannot authorize paid media/i);
  }
  const missing = paidConsentDecision({
    authorizePaid: true,
    acceptedQuoteUsd: undefined,
    quoteUsd: quote,
    status: "confirmed",
    generationStatus: "not_started",
  });
  assert.equal(missing.allowPaid, false);
  const malformed = paidConsentDecision({
    authorizePaid: "true",
    acceptedQuoteUsd: quote,
    quoteUsd: quote,
    status: "confirmed",
    generationStatus: "not_started",
  });
  assert.equal(malformed.allowPaid, false);
  const wrongPrice = paidConsentDecision({
    authorizePaid: true,
    acceptedQuoteUsd: 0.001,
    quoteUsd: quote,
    status: "confirmed",
    generationStatus: "not_started",
  });
  assert.equal(wrongPrice.allowPaid, false);
  const nan = paidConsentDecision({
    authorizePaid: true,
    acceptedQuoteUsd: Number.NaN,
    quoteUsd: quote,
    status: "confirmed",
    generationStatus: "not_started",
  });
  assert.equal(nan.allowPaid, false);
});

test("duplicate generation and unconfirmed campaigns cannot start a paid call", () => {
  const running = paidConsentDecision({
    authorizePaid: true,
    acceptedQuoteUsd: quote,
    quoteUsd: quote,
    status: "confirmed",
    generationStatus: "generating",
  });
  assert.equal(running.allowPaid, false);
  assert.match(running.error, /duplicate|already running/i);
  const drafting = paidConsentDecision({
    authorizePaid: true,
    acceptedQuoteUsd: quote,
    quoteUsd: quote,
    status: "drafting",
    generationStatus: "not_started",
  });
  assert.equal(drafting.allowPaid, false);
});

test("a failed provider is reported without claiming a saved file", () => {
  const refused = providerFailureReport(
    Object.assign(new Error("fal_sk_testsecret request failed"), { status: 401 }),
    "The provider did not return a file.",
  );
  assert.equal(refused.savedFile, false);
  assert.match(refused.note, /rejected this key/i);
  assert.doesNotMatch(refused.note, /fal_sk_|saved|generated a file/i);

  const offline = providerFailureReport(new Error("fetch failed: ENOTFOUND queue.fal.run"));
  assert.equal(offline.savedFile, false);
  assert.match(offline.note, /could not reach fal/i);
  assert.doesNotMatch(offline.note, /finished|saved/i);
});

test("a matching displayed price on a confirmed campaign allows the paid workflow", () => {
  const allowed = paidConsentDecision({
    authorizePaid: true,
    acceptedQuoteUsd: quote,
    quoteUsd: quote,
    status: "confirmed",
    generationStatus: "not_started",
  });
  assert.equal(allowed.allowPaid, true);
  const free = paidConsentDecision({
    authorizePaid: false,
    acceptedQuoteUsd: quote,
    quoteUsd: quote,
    status: "confirmed",
    generationStatus: "not_started",
  });
  assert.equal(free.allowPaid, false);
  assert.equal(free.error, undefined);
});

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
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { status: response.status, data };
}

test("the generate route rejects paid calls that skip the displayed price", async () => {
  const unauthenticated = await api("POST", "/api/campaigns/not-a-real-id/generate", {
    body: { authorizePaid: true, acceptedQuoteUsd: quote },
  });
  assert.equal(unauthenticated.status, 401);

  const ownerLogin = await api("POST", "/api/auth/login", {
    body: { email: "burger-agent@adpilot.local", password: "BurgerPass123" },
  });
  const otherLogin = await api("POST", "/api/auth/login", {
    body: { email: "burger-other@adpilot.local", password: "BurgerPass123" },
  });
  assert.equal(ownerLogin.status, 200, JSON.stringify(ownerLogin.data));
  assert.equal(otherLogin.status, 200, JSON.stringify(otherLogin.data));
  const owner = ownerLogin.data;
  const other = otherLogin.data;
  const started = await api("POST", "/api/businesses", { token: owner.token, csrf: owner.csrf, body: {} });
  assert.equal(started.status, 201, JSON.stringify(started.data).slice(0, 300));
  const businessId = started.data.business.id;
  await api("POST", `/api/businesses/${businessId}/conversation`, {
    token: owner.token,
    csrf: owner.csrf,
    body: { text: "Burger Joint" },
  });
  await api("POST", `/api/businesses/${businessId}/conversation`, {
    token: owner.token,
    csrf: owner.csrf,
    body: { text: "products are burgers" },
  });
  await api("POST", `/api/businesses/${businessId}/conversation`, {
    token: owner.token,
    csrf: owner.csrf,
    body: { text: "I want more orders for my burger restaurant." },
  });
  const campaigns = await api("GET", "/api/campaigns", { token: owner.token, csrf: owner.csrf });
  const campaign = (campaigns.data.campaigns || []).find((item) => item.businessId === businessId);
  assert.ok(campaign);

  const stolen = await api("POST", `/api/campaigns/${campaign.id}/generate`, {
    token: other.token,
    csrf: other.csrf,
    body: { authorizePaid: true, acceptedQuoteUsd: campaign.mediaQuote.totalUsd },
  });
  assert.equal(stolen.status, 404);

  const bare = await api("POST", `/api/campaigns/${campaign.id}/generate`, {
    token: owner.token,
    csrf: owner.csrf,
    body: { authorizePaid: true },
  });
  assert.equal(bare.status, 409);
  assert.match(bare.data.error, /price|confirm|paid/i);

  const wrong = await api("POST", `/api/campaigns/${campaign.id}/generate`, {
    token: owner.token,
    csrf: owner.csrf,
    body: { authorizePaid: true, acceptedQuoteUsd: campaign.mediaQuote.totalUsd + 1 },
  });
  assert.equal(wrong.status, 409);

  const startedCampaign = await api("POST", "/api/campaigns", {
    token: owner.token,
    csrf: owner.csrf,
    body: {
      businessId,
      prompt: "Advertise the burgers from this restaurant. Objective: more orders. No discount.",
    },
  });
  assert.equal(startedCampaign.status, 201, JSON.stringify(startedCampaign.data).slice(0, 300));
  let current = startedCampaign.data.campaign;
  if (current.status === "drafting") {
    const continued = await api("POST", `/api/campaigns/${current.id}/message`, {
      token: owner.token,
      csrf: owner.csrf,
      body: { text: "burgers", skipRemaining: true },
    });
    assert.ok(continued.status < 300, JSON.stringify(continued.data).slice(0, 300));
    current = continued.data.campaign;
  }
  assert.equal(current.status, "brief_ready");
  const chosen = await api("POST", `/api/campaigns/${current.id}/concept`, {
    token: owner.token,
    csrf: owner.csrf,
    body: { useRecommended: true },
  });
  assert.equal(chosen.status, 200, JSON.stringify(chosen.data).slice(0, 300));
  const confirmed = await api("POST", `/api/campaigns/${current.id}/confirm`, {
    token: owner.token,
    csrf: owner.csrf,
  });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.data).slice(0, 400));
  const price = confirmed.data.campaign.mediaQuote.totalUsd;
  assert.equal(typeof price, "number");

  const malformed = await api("POST", `/api/campaigns/${current.id}/generate`, {
    token: owner.token,
    csrf: owner.csrf,
    body: { authorizePaid: "true", acceptedQuoteUsd: price },
  });
  assert.equal(malformed.status, 409);

  const missingPrice = await api("POST", `/api/campaigns/${current.id}/generate`, {
    token: owner.token,
    csrf: owner.csrf,
    body: { authorizePaid: true },
  });
  assert.equal(missingPrice.status, 409);
  assert.match(missingPrice.data.error, /price/i);

  const allowed = await api("POST", `/api/campaigns/${current.id}/generate`, {
    token: owner.token,
    csrf: owner.csrf,
    body: { authorizePaid: true, acceptedQuoteUsd: price, video: false },
  });
  assert.equal(allowed.status, 200, JSON.stringify(allowed.data).slice(0, 400));
  const note = allowed.data.generation?.note || "";
  assert.match(note, /No paid still or video was generated|local preview/i);
  assert.doesNotMatch(note, /Finished still|Finished video|fal returned/i);
  assert.notEqual(allowed.data.generation?.status, "generating");
});
