const SECRET_PREFIX = /fal_sk_[A-Za-z0-9_-]+/g;
const SECRET_PAIR =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[A-Za-z0-9_-]+\b/gi;
const WHITESPACE = /[\s\u0000-\u001F\u007F]/;

export function readFalKey(raw = process.env.FAL_KEY): string {
  const cleaned = (raw ?? "").replace(/[\s\u0000-\u001F\u007F]+/g, "");
  if (raw === process.env.FAL_KEY && process.env.FAL_KEY && process.env.FAL_KEY !== cleaned) {
    process.env.FAL_KEY = cleaned;
  }
  return cleaned;
}

export function falKeyConfigured(): boolean {
  return readFalKey().length > 0;
}

export const INCOMPLETE_FAL_KEY =
  "The fal key on this server is incomplete. Open fal.ai/dashboard/keys, create a key, and copy the full value. It has an id, a colon, and a secret, all on one line.";

export function falKeyProblem(key = readFalKey()): string | null {
  if (!key) return "FAL_KEY is not on the server.";
  const splitAt = key.indexOf(":");
  if (splitAt <= 0 || splitAt >= key.length - 1) return INCOMPLETE_FAL_KEY;
  return null;
}

export function redactFalMessage(message: string): string {
  if (!message.trim()) return "";
  if (/invalid header value/i.test(message)) {
    return "The fal key on this server has a line break or space in it. Set FAL_KEY on one line and restart the server.";
  }
  const secret = readFalKey();
  let cleaned = secret.length >= 8 ? redactEmbedded(message, secret) : message;
  cleaned = cleaned.replace(SECRET_PREFIX, "[redacted]").replace(SECRET_PAIR, "[redacted]");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 240) || "fal request failed";
}

export function publicFalError(error: unknown, fallback = "fal request failed"): string {
  const status = statusOf(error);
  if (status === 401) {
    return "fal rejected this key. Create a new key at fal.ai/dashboard/keys and set the full value, including the colon, on one line.";
  }
  if (status === 403) {
    return "This fal key is not allowed to generate images. Create a key with the API preset at fal.ai/dashboard/keys.";
  }
  const message = error instanceof Error && error.message.trim() ? error.message.trim() : "";
  const detail = detailOf(error);
  const code = causeCode(error);
  const text = [message, detail, code].filter(Boolean).join(" — ") || fallback;
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|UND_ERR_CONNECT|UND_ERR_SOCKET/i.test(text)) {
    return "Could not reach fal from this Mac. Check the internet connection, then try again.";
  }
  return redactFalMessage(text) || fallback;
}

function statusOf(error: unknown): number {
  if (!error || typeof error !== "object" || !("status" in error)) return 0;
  const status = Number(error.status);
  return Number.isInteger(status) ? status : 0;
}

function detailOf(error: unknown): string {
  if (!error || typeof error !== "object" || !("body" in error)) return "";
  const body = error.body;
  if (!body || typeof body !== "object" || !("detail" in body)) return "";
  const detail = body.detail;
  if (typeof detail === "string") return detail.trim();
  if (!Array.isArray(detail)) return "";
  return detail
    .map((item) => {
      if (!item || typeof item !== "object" || !("msg" in item)) return "";
      return typeof item.msg === "string" ? item.msg.trim() : "";
    })
    .filter(Boolean)
    .join("; ");
}

function causeCode(error: unknown): string {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && typeof current.code === "string" && /^[A-Z0-9_]+$/.test(current.code)) {
      return current.code;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return "";
}

function redactEmbedded(message: string, secret: string): string {
  let cleaned = message;
  let guard = 0;
  while (guard < 4) {
    const span = findSpan(cleaned, secret);
    if (!span) break;
    cleaned = `${cleaned.slice(0, span.from)}[redacted]${cleaned.slice(span.to)}`;
    guard += 1;
  }
  return cleaned;
}

function findSpan(message: string, secret: string): { from: number; to: number } | null {
  const compact: string[] = [];
  const indexes: number[] = [];
  for (let index = 0; index < message.length; index += 1) {
    if (WHITESPACE.test(message[index] ?? "")) continue;
    compact.push(message[index] ?? "");
    indexes.push(index);
  }
  const start = compact.join("").indexOf(secret);
  if (start < 0) return null;
  const from = indexes[start];
  const to = indexes[start + secret.length - 1];
  if (from === undefined || to === undefined) return null;
  return { from, to: to + 1 };
}
