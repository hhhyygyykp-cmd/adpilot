import type { Business, CampaignFacts, HistoryItem } from "../types";

export type ProductCategory = "fragrance" | "food" | "general";

export function detectCategory(text: string): ProductCategory {
  const value = text.toLowerCase();
  if (/perfume|fragrance|cologne|eau de|scent|عطر|بارفان|كولون/.test(value)) return "fragrance";
  if (/burger|meal|pizza|food|restaurant|smash|grill|fries|مطع|برجر/.test(value)) return "food";
  return "general";
}

export function isNewProductIntent(prompt: string): boolean {
  return /\bthere is a new\b|\ba new (perfume|fragrance|cologne|product|range|line|item)\b|\bnew (perfume|fragrance|cologne|product)\b|\blaunch(?:ing)?\b|\bwe (?:have|added) a new\b|\bعطر جديد\b|\bمنتج جديد\b/i.test(
    prompt,
  );
}

export function isGenericProductName(name: string | null): boolean {
  if (!name) return true;
  return /^(a |the )?(new )?(perfume|fragrance|cologne|product|item|عطر)$/i.test(name.trim());
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").trim();
}

export function similarProduct(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const tokens = (value: string) => value.split(" ").filter((part) => part.length > 3);
  const aTokens = new Set(tokens(left));
  const overlap = tokens(right).filter((part) => aTokens.has(part));
  return overlap.length >= 2;
}

export function refersToPrior(prompt: string): boolean {
  return /again|another|same|the usual|once more|كمان|مرة أخرى|نفس|أيضا|برضو/i.test(prompt);
}

export function sameProductContext(input: {
  prompt: string;
  productName: string | null;
  item: HistoryItem;
}): boolean {
  const currentCat = detectCategory(`${input.prompt} ${input.productName ?? ""}`);
  const historyCat = detectCategory(`${input.item.originalPrompt} ${input.item.productName ?? ""}`);
  if (currentCat !== "general" && historyCat !== "general" && currentCat !== historyCat) {
    return false;
  }
  if (isNewProductIntent(input.prompt) && !similarProduct(input.productName, input.item.productName)) {
    if (currentCat !== historyCat) return false;
    if (!similarProduct(input.productName, input.item.productName)) return false;
  }
  if (input.productName && input.item.productName && !similarProduct(input.productName, input.item.productName)) {
    return false;
  }
  return (
    similarProduct(input.productName, input.item.productName) ||
    (refersToPrior(input.prompt) && currentCat === historyCat && currentCat !== "general")
  );
}

export function advertisingThisBusiness(input: {
  prompt: string;
  productName: string | null;
  business: Pick<Business, "name" | "category" | "productsServices">;
}): boolean {
  if (similarProduct(input.productName, input.business.productsServices) || similarProduct(input.productName, input.business.name)) {
    return true;
  }
  const productCat = detectCategory(`${input.prompt} ${input.productName ?? ""}`);
  const bizCat = detectCategory(
    `${input.business.category} ${input.business.productsServices} ${input.business.name}`,
  );
  if (productCat !== "general" && bizCat !== "general" && productCat !== bizCat) return false;
  if (isNewProductIntent(input.prompt) && productCat !== bizCat) return false;
  return productCat === bizCat && productCat !== "general";
}

export function brandForCopy(input: {
  prompt: string;
  productName: string | null;
  business: Pick<Business, "name" | "category" | "productsServices">;
}): string {
  if (!advertisingThisBusiness(input)) return "";
  return input.business.name.trim();
}

export function withoutForeignBrand(
  text: string,
  input: {
    prompt: string;
    productName: string | null;
    business: Pick<Business, "name" | "category" | "productsServices">;
  },
): string {
  if (advertisingThisBusiness(input)) return text;
  const name = input.business.name.trim();
  if (!name) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(escaped, "i").test(text)) return text;
  return text
    .replace(new RegExp(escaped, "gi"), "")
    .replace(/\s+as a worn\s+/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:·—.–-]+|[\s,;:·—.–-]+$/g, "")
    .trim();
}

export function relevantHistory(
  history: HistoryItem[],
  prompt: string,
  productName: string | null,
): HistoryItem[] {
  return history.filter((item) => sameProductContext({ prompt, productName, item }));
}

export function reuseFromHistory(
  facts: CampaignFacts,
  history: HistoryItem[],
  prompt: string,
): { facts: CampaignFacts; reused: string[]; historyNote: string } {
  const relevant = relevantHistory(history, prompt, facts.productName);
  if (isNewProductIntent(prompt) && relevant.length === 0) {
    return {
      facts,
      reused: [],
      historyNote:
        "New product. Did not copy the previous product, offer, objective, or concept.",
    };
  }
  const last = relevant.find((item) => item.status === "confirmed") ?? relevant[0];
  if (!last) {
    return {
      facts,
      reused: [],
      historyNote:
        history.length > 0
          ? "Earlier briefs exist for this business but they are a different product, so they were not used."
          : "No earlier brief on file for this product.",
    };
  }
  if (!sameProductContext({ prompt, productName: facts.productName, item: last })) {
    return {
      facts,
      reused: [],
      historyNote: "Did not reuse history — this request is not the same product.",
    };
  }
  const reused: string[] = [];
  const next = { ...facts };
  if (!next.productName && last.productName) {
    next.productName = last.productName;
    reused.push(`product (${last.productName})`);
  }
  if (!next.offer && last.offer && similarProduct(next.productName, last.productName)) {
    next.offer = last.offer;
    reused.push(`offer (${last.offer})`);
  }
  if (!next.objective && last.objective && similarProduct(next.productName, last.productName)) {
    next.objective = last.objective;
    reused.push(`objective (${last.objective})`);
  }
  return {
    facts: next,
    reused,
    historyNote:
      reused.length > 0
        ? `Reused from the same product context: ${reused.join(", ")}.`
        : "Same product context, but nothing extra was copied.",
  };
}
