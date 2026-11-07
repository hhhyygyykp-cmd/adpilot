import "server-only";

import { listMemory } from "../queries/memory";
import type {
  Business,
  CampaignFacts,
  ConceptSet,
  HistoryItem,
  MarketingPlan,
  MemoryEntry,
} from "../types";
import { proposeConcepts } from "./concepts";
import { brandForCopy, detectCategory, withoutForeignBrand } from "./context";
import { chooseFramework, FRAMEWORKS, type Framework } from "./knowledge";

export type ToolName =
  | "retrieve_business_profile"
  | "retrieve_campaign_history"
  | "retrieve_memory"
  | "consult_knowledge_base"
  | "select_marketing_strategy"
  | "write_copy"
  | "propose_concepts"
  | "generate_image"
  | "generate_video";

export type ToolOk<T> = { tool: ToolName; ok: true; data: T };
export type ToolErr = { tool: ToolName; ok: false; error: string };
export type ToolResult<T = unknown> = ToolOk<T> | ToolErr;

export type BusinessProfileView = {
  id: string;
  name: string;
  category: string;
  description: string;
  productsServices: string;
  targetCustomers: string;
  location: string;
  brandPersonality: string;
  marketingGoals: string;
  photoCount: number;
  logoCount: number;
};

export type StrategyChoice = {
  framework: Framework;
  reason: string;
  considered: string[];
  audience: string;
  angle: string;
};

export type CopyOutput = {
  hooks: string[];
  cta: string;
  creativeDirection: string;
};

export function retrieveBusinessProfile(business: Business): ToolResult<BusinessProfileView> {
  return {
    tool: "retrieve_business_profile",
    ok: true,
    data: {
      id: business.id,
      name: business.name,
      category: business.category,
      description: business.description,
      productsServices: business.productsServices,
      targetCustomers: business.targetCustomers,
      location: business.location,
      brandPersonality: business.brandPersonality,
      marketingGoals: business.marketingGoals,
      photoCount: business.assetCounts?.productPhoto ?? 0,
      logoCount: business.assetCounts?.logo ?? 0,
    },
  };
}

export function retrieveCampaignHistoryTool(history: HistoryItem[]): ToolResult<HistoryItem[]> {
  return { tool: "retrieve_campaign_history", ok: true, data: history };
}

export async function retrieveMemoryTool(
  customerId: string,
  businessId: string,
): Promise<ToolResult<MemoryEntry[]>> {
  const entries = await listMemory(customerId, businessId);
  return { tool: "retrieve_memory", ok: true, data: entries };
}

export function consultKnowledgeBase(input: {
  facts: CampaignFacts;
  business: Business;
  prompt: string;
}): ToolResult<{ chosen: Framework; reason: string; considered: string[] }> {
  const choice = chooseFramework({
    hasOffer: Boolean(input.facts.offer),
    objective: input.facts.objective,
    category: input.business.category,
    personality: input.business.brandPersonality,
    hasPhotos: (input.business.assetCounts?.productPhoto ?? 0) > 0,
    prompt: input.prompt,
    productName: input.facts.productName,
  });
  return {
    tool: "consult_knowledge_base",
    ok: true,
    data: { chosen: choice.framework, reason: choice.reason, considered: choice.considered },
  };
}

export function selectMarketingStrategy(input: {
  facts: CampaignFacts;
  business: Business;
  prompt: string;
  knowledge: { chosen: Framework; reason: string; considered: string[] };
}): ToolResult<StrategyChoice> {
  const product = input.facts.productName || "this offering";
  const sameLane =
    detectCategory(`${input.facts.productName ?? ""} ${input.prompt}`) ===
    detectCategory(`${input.business.category} ${input.business.productsServices}`);
  const audience =
    input.facts.audienceNote?.trim() ||
    (sameLane ? input.business.targetCustomers.trim() : "") ||
    (input.business.location
      ? `People near ${input.business.location} who would buy ${product}`
      : `People who would buy ${product}`);
  const angle = buildAngle(input.facts, input.knowledge.chosen, input.business, input.prompt);
  return {
    tool: "select_marketing_strategy",
    ok: true,
    data: {
      framework: input.knowledge.chosen,
      reason: input.knowledge.reason,
      considered: input.knowledge.considered,
      audience,
      angle,
    },
  };
}

export function writeCopy(input: {
  facts: CampaignFacts;
  business: Business;
  strategy: StrategyChoice;
  prompt?: string;
}): ToolResult<CopyOutput> {
  const product = input.facts.productName?.trim() || "this offering";
  const offer = input.facts.offer;
  const brand = brandForCopy({
    prompt: input.prompt ?? "",
    productName: input.facts.productName,
    business: input.business,
  });
  const category = detectCategory(`${input.prompt ?? ""} ${input.facts.productName ?? ""}`);
  const brandInput = {
    prompt: input.prompt ?? "",
    productName: input.facts.productName,
    business: input.business,
  };
  const hooks = hooksFor(input.strategy.framework.id, product, offer, brand, category).map((line) =>
    withoutForeignBrand(line, brandInput),
  );
  const cta = ctaFor(input.facts, product);
  const creativeDirection = withoutForeignBrand(
    directionFor(input.strategy.framework.id, product, offer, input.business, category),
    brandInput,
  );
  return {
    tool: "write_copy",
    ok: true,
    data: { hooks, cta, creativeDirection },
  };
}

export function proposeConceptsTool(input: {
  business: Business;
  facts: CampaignFacts;
  plan: MarketingPlan;
  prompt?: string;
}): ToolResult<ConceptSet> {
  return {
    tool: "propose_concepts",
    ok: true,
    data: proposeConcepts(input),
  };
}

export function generateImageRefused(): ToolErr {
  return {
    tool: "generate_image",
    ok: false,
    error:
      "Call POST /api/campaigns/:id/generate after confirm. Paid fal stills need an explicit authorize. Pollinations is the free still fallback when FAL_KEY is unset.",
  };
}

export function generateVideoRefused(): ToolErr {
  return {
    tool: "generate_video",
    ok: false,
    error:
      "Paid MiniMax Hailuo video on fal needs FAL_KEY and explicit customer authorization. Nothing was labeled as video.",
  };
}

export function knowledgeCatalog() {
  return FRAMEWORKS;
}

function buildAngle(facts: CampaignFacts, framework: Framework, business: Business, prompt = ""): string {
  const product = facts.productName || "the product";
  const category = detectCategory(`${prompt} ${facts.productName ?? ""}`);
  if (framework.id === "offer_positioning" && facts.offer) {
    return `Put the verified ${facts.offer} next to ${product} so the value is obvious.`;
  }
  if (framework.id === "direct_response") {
    return `Ask for the order in plain language, using only ${product}${facts.offer ? ` and ${facts.offer}` : ""}.`;
  }
  if (framework.id === "emotional_hooks") {
    return category === "fragrance"
      ? `Lead with how ${product} looks in the hand — glass, light, pause — not a slogan and not invented notes.`
      : `Lead with how ${product} feels — appetite, heat, share — not a slogan about performance.`;
  }
  if (framework.id === "product_demo") {
    return category === "fragrance"
      ? `Show the ${product} bottle as the hero. Do not replace it with a fashion portrait.`
      : `Show ${product} being made or served. Do not hide the food behind lifestyle only.`;
  }
  if (framework.id === "curiosity") {
    const brand = brandForCopy({ prompt, productName: facts.productName, business });
    return `Open on a true detail of ${brand || product} the viewer has not been told yet.`;
  }
  return `Stay with ${product} and the facts the customer actually gave.`;
}

function hooksFor(
  frameworkId: string,
  product: string,
  offer: string | null,
  brand: string,
  category: ReturnType<typeof detectCategory>,
): string[] {
  const priced = offer ? `${product} · ${offer}` : product;
  const withBrand = (line: string) => (brand ? `${brand} — ${line}` : line);
  if (category === "fragrance") {
    return [
      `The bottle. ${product}.`,
      offer ? `${product} · ${offer}` : product,
      `Discover ${product}`,
    ];
  }
  switch (frameworkId) {
    case "offer_positioning":
      return [
        offer ? `${product} for ${offer}` : priced,
        offer ? withBrand(`${product} at ${offer}`) : withBrand(product),
        offer ? `Today: ${product}, ${offer}` : product,
      ];
    case "direct_response":
      return [
        `Order the ${product}`,
        offer ? `${product} is ${offer}. Order now.` : `Get the ${product}`,
        withBrand(product),
      ];
    case "emotional_hooks":
      return [
        `The ${product}, hot off the press`,
        brand ? `${brand} built this ${product} to be eaten, not admired` : `The ${product}, ready to eat`,
        offer ? `${product} — ${offer}` : product,
      ];
    case "product_demo":
      return [
        `Watch the ${product} come together`,
        `This is the ${product}`,
        offer ? `${product}, ${offer}` : product,
      ];
    case "pas":
    case "problem_solution":
      return [
        `When lunch has to be the ${product}`,
        `${product} — the straightforward fix`,
        offer ? `${product} for ${offer}` : product,
      ];
    default:
      return [priced, withBrand(product), offer ? `${product} · ${offer}` : product];
  }
}

function ctaFor(facts: CampaignFacts, product: string): string {
  const objective = (facts.objective ?? "").toLowerCase();
  if (objective.includes("order") || objective.includes("طلب")) {
    return facts.offer ? `Order the ${product} — ${facts.offer}` : `Order the ${product}`;
  }
  if (objective.includes("inquir") || objective.includes("استفسار")) {
    return `Ask about the ${product}`;
  }
  if (objective.includes("aware") || objective.includes("وعي")) {
    return `See the ${product}`;
  }
  return facts.offer ? `Get the ${product} for ${facts.offer}` : `Choose the ${product}`;
}

function directionFor(
  frameworkId: string,
  product: string,
  offer: string | null,
  business: Business,
  category: ReturnType<typeof detectCategory>,
): string {
  const logo = (business.assetCounts?.logo ?? 0) > 0 ? "Keep the uploaded logo visible." : "No logo is on file yet.";
  const photos =
    (business.assetCounts?.productPhoto ?? 0) > 0
      ? category === "fragrance"
        ? "Use the uploaded product photographs; keep the named bottle in frame."
        : "Use the uploaded product photographs; do not replace the food."
      : "No product photographs are on file; any later visual must still show the named product.";
  const price = offer ? `If type is added later, the price must read exactly ${offer}.` : "No verified price to typeset.";
  const extra =
    category === "fragrance"
      ? `Hierarchy: the ${product} bottle first. Do not invent scent notes.`
      : frameworkId === "product_demo"
        ? "Prefer close, honest product shots over generic lifestyle."
        : frameworkId === "offer_positioning"
          ? "The offer should be readable in the first glance, never paraphrased."
          : "Hierarchy: product first, then any verified offer, then a short CTA.";
  return `${extra} ${photos} ${logo} ${price}`;
}
