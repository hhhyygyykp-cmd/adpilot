import type { Business, CampaignFacts, FormatPreference } from "../types";

const SKIP_RE =
  /^(skip|none|n\/a|na|no|not sure|later|تخطي|لا أعرف|مش متأكد|لاحقاً|بدون)$/i;

export function isSkip(text: string): boolean {
  return SKIP_RE.test(text.trim());
}

export function extractOffer(text: string): string | null {
  const patterns = [
    /(?:AED|Dhs|Dh|UAE\s*Dirhams?|درهم)\s*[:.]?\s*(\d+(?:[.,]\d+)?)/i,
    /(\d+(?:[.,]\d+)?)\s*(?:AED|Dhs|Dh|درهم)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = match[1].replace(",", "");
      return `AED ${amount}`;
    }
  }
  return null;
}

export function extractObjective(text: string): string | null {
  const rules: Array<[RegExp, string]> = [
    [/increase orders|more orders|boost(?:ing)? (?:sales|orders)|زيادة الطلبات|زيادة المبيعات/i, "Increase orders"],
    [/brand awareness|awareness|الوعي بالعلامة|زيادة الوعي/i, "Brand awareness"],
    [/more (?:customers|clients)|new customers|عملاء جدد|زبائن أكثر/i, "Attract more customers"],
    [/footfall|store visits|زيارات/i, "Increase store visits"],
    [/leads|inquir(?:y|ies)|استفسارات/i, "Generate inquiries"],
  ];
  for (const [pattern, label] of rules) {
    if (pattern.test(text)) return label;
  }
  return null;
}

export function extractFormat(text: string): FormatPreference | null {
  if (/both|صورة وفيديو|الاثنين/i.test(text) && /image|video|صورة|فيديو/i.test(text)) {
    return "both";
  }
  if (/recommend|decide|you choose|اقترح|أنت قرر/i.test(text)) return "ai_recommend";
  if (/video|فيديو/i.test(text) && !/image|صورة/i.test(text)) return "video";
  if (/image|photo|صورة/i.test(text) && !/video|فيديو/i.test(text)) return "image";
  if (/video|فيديو/i.test(text) && /image|صورة/i.test(text)) return "both";
  return null;
}

export function extractProduct(text: string, business: Business | null): string | null {
  const offerSplit = text.match(
    /(?:advertise|promote|sell|launch|أعلن(?:ي)?(?:\s+عن)?|روّج(?:ي)?(?:\s+ل)?)\s+(?:our|my|the|ل)?\s*(.+?)(?:\s+for\s+|\s+at\s+|\s+بـ|\s+بسعر|\s+to\s+increase|\s+to\s+boost|$)/i,
  );
  if (offerSplit?.[1]) {
    const cleaned = cleanProduct(offerSplit[1]);
    if (cleaned) return cleaned;
  }
  const forPrice = text.match(/(.+?)\s+for\s+(?:AED|Dhs|Dh|درهم)/i);
  if (forPrice?.[1]) {
    const cleaned = cleanProduct(forPrice[1].replace(/^.*\b(?:our|my|the)\s+/i, ""));
    if (cleaned) return cleaned;
  }
  if (business?.productsServices) {
    const listed = business.productsServices
      .split(/[,;\n]/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3);
    const lower = text.toLowerCase();
    const hit = listed.find((item) => lower.includes(item.toLowerCase()));
    if (hit) return hit;
  }
  const named = text.match(
    /(?:called|named|اسمه|اسمها)\s+["']?([A-Za-z\u0600-\u06ff][^.,;]{1,80})/i,
  );
  if (named?.[1]) {
    const cleaned = cleanProduct(named[1]);
    if (cleaned) return cleaned;
  }
  return null;
}

function cleanProduct(value: string): string | null {
  const trimmed = value
    .replace(/^(our|my|the|this|a|an)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:]+$/, "");
  if (trimmed.length < 3 || trimmed.length > 120) return null;
  if (/^(something|it|this|that)$/i.test(trimmed)) return null;
  return trimmed;
}

export function extractMustAppear(text: string): string | null {
  const match = text.match(
    /(?:must (?:appear|show|include)|include|show|يظهر|يجب أن يظهر)\s*[:–-]?\s*(.+)$/i,
  );
  if (match?.[1]) return match[1].trim();
  return null;
}

export function extractFromUtterance(
  text: string,
  business: Business | null,
): Partial<CampaignFacts> {
  return {
    productName: extractProduct(text, business),
    offer: extractOffer(text),
    objective: extractObjective(text),
    formatPreference: extractFormat(text),
    mustAppear: extractMustAppear(text),
  };
}

export function mergeFacts(
  current: CampaignFacts,
  incoming: Partial<CampaignFacts>,
): CampaignFacts {
  return {
    productName: incoming.productName || current.productName,
    offer: incoming.offer || current.offer,
    objective: incoming.objective || current.objective,
    formatPreference: incoming.formatPreference || current.formatPreference,
    existingPhotosNote: incoming.existingPhotosNote || current.existingPhotosNote,
    mustAppear: incoming.mustAppear || current.mustAppear,
    audienceNote: incoming.audienceNote || current.audienceNote,
  };
}

export function emptyFacts(): CampaignFacts {
  return {
    productName: null,
    offer: null,
    objective: null,
    formatPreference: null,
    existingPhotosNote: null,
    mustAppear: null,
    audienceNote: null,
  };
}
