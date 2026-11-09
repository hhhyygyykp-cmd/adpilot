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
  const message = error instanceof Error && error.message ? error.message : fallback;
  return redactFalMessage(message);
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
