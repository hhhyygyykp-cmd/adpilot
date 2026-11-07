import { detectCategory } from "./context";

export type FrameworkId =
  | "aida"
  | "pas"
  | "before_after_bridge"
  | "problem_solution"
  | "benefit_focused"
  | "direct_response"
  | "emotional_hooks"
  | "curiosity"
  | "product_demo"
  | "offer_positioning"
  | "persuasive_cta";

export type Framework = {
  id: FrameworkId;
  name: string;
  nameAr: string;
  summary: string;
  whenToUse: string;
  whenNotToUse: string;
};

export const FRAMEWORKS: Framework[] = [
  {
    id: "offer_positioning",
    name: "Offer positioning",
    nameAr: "تموضع العرض",
    summary: "Lead with a verified price or promotion as the reason to act.",
    whenToUse: "A specific price or offer is on file and the goal is orders or sales.",
    whenNotToUse: "No verified offer exists, or inventing a discount would be required.",
  },
  {
    id: "direct_response",
    name: "Direct response",
    nameAr: "استجابة مباشرة",
    summary: "Ask for one clear action now, tied to a real product and objective.",
    whenToUse: "The customer wants orders, bookings, or inquiries, not just awareness.",
    whenNotToUse: "The brief is only about brand feel and no action is named.",
  },
  {
    id: "emotional_hooks",
    name: "Emotional hooks",
    nameAr: "خطافات عاطفية",
    summary: "Lead with appetite, comfort, pride, or belonging rather than a price.",
    whenToUse: "Food, hospitality, or a named brand personality, especially when the offer is not the hero.",
    whenNotToUse: "The only verified distinctive fact is a price and the goal is conversion.",
  },
  {
    id: "product_demo",
    name: "Product demonstration",
    nameAr: "عرض المنتج",
    summary: "Show the product doing the work — smash, steam, pour, wear.",
    whenToUse: "A physical product is named and photographs exist or can be the subject.",
    whenNotToUse: "The product is an abstract service with nothing to show.",
  },
  {
    id: "pas",
    name: "Problem–Agitate–Solve",
    nameAr: "مشكلة — تضخيم — حل",
    summary: "Name a real problem, make it felt, then present the product as the fix.",
    whenToUse: "The request itself describes a pain (slow lunch, expensive meals, low traffic).",
    whenNotToUse: "No problem was stated; do not invent one.",
  },
  {
    id: "problem_solution",
    name: "Problem–solution",
    nameAr: "مشكلة وحل",
    summary: "A shorter problem-to-fix structure without extra agitation.",
    whenToUse: "A concrete problem is stated and the product is the remedy.",
    whenNotToUse: "The brief is celebratory or offer-led with no problem named.",
  },
  {
    id: "before_after_bridge",
    name: "Before–After–Bridge",
    nameAr: "قبل — بعد — جسر",
    summary: "Contrast life before and after, then bridge with the product.",
    whenToUse: "The customer describes a transformation or a before/after state.",
    whenNotToUse: "No change-of-state language is in the brief.",
  },
  {
    id: "benefit_focused",
    name: "Benefit-focused",
    nameAr: "تركيز على الفائدة",
    summary: "Lead with what the customer gains, not features.",
    whenToUse: "Benefits can be inferred from the product without inventing claims.",
    whenNotToUse: "A stronger specific fit (offer, problem, demo) is already present.",
  },
  {
    id: "curiosity",
    name: "Curiosity",
    nameAr: "فضول",
    summary: "Open a question the ad can honestly answer.",
    whenToUse: "The objective is awareness and no urgent offer is on file.",
    whenNotToUse: "A verified offer and a conversion objective already demand a direct ask.",
  },
  {
    id: "aida",
    name: "AIDA",
    nameAr: "أيدا",
    summary: "Attention, interest, desire, action — a general arc.",
    whenToUse: "No more specific framework fits the evidence we actually have.",
    whenNotToUse: "A more specific fit (offer, problem, demo, emotion) is available. Do not default here.",
  },
  {
    id: "persuasive_cta",
    name: "Persuasive CTA",
    nameAr: "دعوة إقناع",
    summary: "A single, specific next step using only verified facts.",
    whenToUse: "Always as a finishing tactic when an action is known. Rarely the whole strategy.",
    whenNotToUse: "As a standalone framework when a richer structure already fits.",
  },
];

export function frameworkById(id: string): Framework | undefined {
  return FRAMEWORKS.find((item) => item.id === id);
}

export type ScoreContext = {
  hasOffer: boolean;
  objective: string | null;
  category: string;
  personality: string;
  hasPhotos: boolean;
  prompt: string;
  productName: string | null;
};

export function scoreFrameworks(ctx: ScoreContext): Array<{ framework: Framework; score: number; reason: string }> {
  const prompt = ctx.prompt.toLowerCase();
  const objective = (ctx.objective ?? "").toLowerCase();
  const category = ctx.category.toLowerCase();
  const lane = detectCategory(`${ctx.prompt} ${ctx.productName ?? ""}`);
  const food =
    lane === "food" ||
    (lane === "general" && /restaurant|burger|food|cafe|café|grill|meal|مطع/.test(category));
  const conversion = /order|sales|inquir|lead|book|زيادة الطلب|مبيعات/.test(objective);
  const awareness = /aware|brand|وعي/.test(objective);
  const problem = /too slow|expensive|problem|struggle|tired of|مشكلة|غالي/.test(prompt);
  const transform = /before|after|used to|now we|تحول|قبل|بعد/.test(prompt);

  return FRAMEWORKS.map((framework) => {
    let score = 0;
    let reason = framework.whenToUse;
    switch (framework.id) {
      case "offer_positioning":
        if (ctx.hasOffer) score += 6;
        if (conversion) score += 3;
        if (food && ctx.hasOffer) score += 1;
        if (!ctx.hasOffer) score -= 8;
        reason = ctx.hasOffer
          ? "A verified offer is on file and the goal is commercial."
          : "No verified offer to position.";
        break;
      case "direct_response":
        if (conversion) score += 5;
        if (ctx.hasOffer) score += 2;
        if (ctx.productName) score += 1;
        if (awareness && !conversion) score -= 3;
        reason = conversion
          ? "The objective asks for a concrete action."
          : "The brief is not asking for an immediate response.";
        break;
      case "emotional_hooks":
        if (food) score += 4;
        if (/warm|bold|premium|playful|دافئ|جريء/.test(ctx.personality.toLowerCase())) score += 2;
        if (ctx.hasOffer && conversion) score -= 2;
        reason = food
          ? "Food advertising can lead with appetite when price is not the only fact."
          : "Emotional lead is weaker without a sensory product.";
        break;
      case "product_demo":
        if (ctx.productName) score += 3;
        if (ctx.hasPhotos) score += 3;
        if (food) score += 2;
        reason = ctx.hasPhotos
          ? "Product photographs are on file to demonstrate with."
          : "A named product can still be shown even without uploaded photos.";
        break;
      case "pas":
        if (problem) score += 7;
        else score -= 4;
        reason = problem
          ? "The request names a problem we can work from."
          : "No problem was stated; PAS would invent one.";
        break;
      case "problem_solution":
        if (problem) score += 6;
        else score -= 4;
        reason = problem
          ? "A stated problem maps cleanly to a solution."
          : "No problem is on file.";
        break;
      case "before_after_bridge":
        if (transform) score += 7;
        else score -= 3;
        reason = transform
          ? "The brief describes a before and after."
          : "No transformation language to bridge.";
        break;
      case "benefit_focused":
        score += 2;
        if (ctx.productName) score += 1;
        if (ctx.hasOffer && conversion) score -= 1;
        reason = "A modest fit when we can name a gain without extra claims.";
        break;
      case "curiosity":
        if (awareness) score += 5;
        if (ctx.hasOffer && conversion) score -= 4;
        reason = awareness
          ? "Awareness work can open a question instead of a hard ask."
          : "Curiosity is a poor fit for a conversion brief with an offer.";
        break;
      case "aida":
        score += 1;
        if (ctx.hasOffer || problem || transform) score -= 2;
        reason = "General arc only when nothing more specific fits the evidence.";
        break;
      case "persuasive_cta":
        if (conversion) score += 2;
        score -= 1;
        reason = "Used as a finishing tactic, not the whole strategy.";
        break;
      default:
        break;
    }
    return { framework, score, reason };
  }).sort((a, b) => b.score - a.score);
}

export function chooseFramework(ctx: ScoreContext): { framework: Framework; reason: string; considered: string[] } {
  const ranked = scoreFrameworks(ctx).filter((row) => row.score > 0);
  const winner = ranked[0] ?? {
    framework: FRAMEWORKS.find((item) => item.id === "benefit_focused")!,
    score: 0,
    reason: "Fallback: no stronger framework matched the evidence.",
  };
  return {
    framework: winner.framework,
    reason: winner.reason,
    considered: ranked.slice(0, 4).map((row) => `${row.framework.name} (${row.score})`),
  };
}
