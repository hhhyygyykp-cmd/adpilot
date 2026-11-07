import type {
  Business,
  CampaignFacts,
  ConceptLane,
  ConceptSet,
  FormatPreference,
  MarketingConcept,
  MarketingPlan,
} from "../types";
import { brandForCopy, detectCategory, type ProductCategory } from "./context";

function productOf(facts: CampaignFacts): string {
  return facts.productName?.trim() || "this offering";
}

function formatFor(lane: ConceptLane, preference: FormatPreference | null): "image" | "video" {
  if (preference === "image") return "image";
  if (preference === "video") return "video";
  if (lane === "lifestyle") return "video";
  return "image";
}

function conversion(objective: string | null): boolean {
  return /order|sales|inquir|lead|book|زيادة الطلب|مبيعات/i.test(objective ?? "");
}

export function emptyConceptSet(): ConceptSet {
  return {
    concepts: [],
    recommendedId: "",
    recommendationReason: "",
    selectedId: null,
    chosenBy: null,
  };
}

export function proposeConcepts(input: {
  business: Business;
  facts: CampaignFacts;
  plan: MarketingPlan;
  prompt?: string;
}): ConceptSet {
  const category = detectCategory(
    `${input.prompt ?? ""} ${input.facts.productName ?? ""} ${input.facts.audienceNote ?? ""} ${input.business.category}`,
  );
  const promptCat = detectCategory(`${input.prompt ?? ""} ${input.facts.productName ?? ""}`);
  const lane: ProductCategory = promptCat !== "general" ? promptCat : category;
  const product = productOf(input.facts);
  const brand = brandForCopy({
    prompt: input.prompt ?? "",
    productName: input.facts.productName,
    business: input.business,
  });
  const offer = input.facts.offer;
  const place = input.business.location.trim();
  const pref = input.facts.formatPreference;
  const audience =
    input.facts.audienceNote?.trim() ||
    input.plan.audience ||
    `people who would choose ${product}`;

  const sensory: MarketingConcept =
    lane === "fragrance"
      ? {
          id: "appetite",
          lane: "appetite",
          title: "The scent",
          hook: `The bottle. The pause before ${product}.`,
          coreMessage: `Lead with how ${product} looks in the hand — glass, light, mist. Do not invent notes, accords, or a mood the customer did not give.`,
          audienceBenefit: `${audience} should want to pick the bottle up, not read a made-up fragrance pyramid.`,
          creativeDirection: `Quiet luxury still: the named bottle, clean light, no fake ingredient list. Do not typeset a price unless ${offer || "one is verified"}. No invented blossom fields.`,
          recommendedFormat: formatFor("appetite", pref),
          cta: `Discover ${product}`,
        }
      : {
          id: "appetite",
          lane: "appetite",
          title: lane === "food" ? "Appetite" : "The product",
          hook:
            lane === "food" ? `The ${product}, still hissing` : `See ${product}, as it is`,
          coreMessage:
            lane === "food"
              ? `Lead with how ${product} looks and feels — heat, bun, melt — not a slogan and not a price.`
              : `Show ${product} clearly. Use only facts on file.`,
          audienceBenefit: `${audience} should want ${product} before they think about an errand.`,
          creativeDirection:
            lane === "food"
              ? `Close, honest food photography of ${product}. Do not invent a price overlay.`
              : `Honest product photography of ${product}. No invented claims.`,
          recommendedFormat: formatFor("appetite", pref),
          cta: lane === "food" ? `Come eat the ${product}` : `See ${product}`,
        };

  const offerConcept: MarketingConcept = {
    id: "offer",
    lane: "offer",
    title: "The offer",
    hook: offer ? `${product} · ${offer}` : `${product}, plainly presented`,
    coreMessage: offer
      ? brand
        ? `${brand} already named a price. The ad should make ${product} at ${offer} impossible to miss.`
        : `A verified price is on file. The ad should make ${product} at ${offer} impossible to miss.`
      : `No verified price is on file. Talk about ${product} as a straightforward choice — never invent a number or a discount.`,
    audienceBenefit: offer
      ? `The viewer knows exactly what they get and what it costs: ${offer}.`
      : `The viewer gets a clear reason to choose ${product} without a made-up price.`,
    creativeDirection: offer
      ? `Product first, then the exact text ${offer} — never paraphrased.`
      : `Show ${product} clearly. Leave space for a price only if the customer later provides one.`,
    recommendedFormat: formatFor("offer", pref),
    cta: offer ? `Get ${product} — ${offer}` : `Choose ${product}`,
  };

  const lifestyle: MarketingConcept =
    lane === "fragrance"
      ? {
          id: "lifestyle",
          lane: "lifestyle",
          title: "The moment",
          hook: brand && place ? `An evening in ${place}` : `The moment you put it on`,
          coreMessage: brand
            ? `Wear ${brand}'s ${product} — a person, a room, the bottle still in frame. No fake testimonials.`
            : `Wear ${product} — a person, a room, the bottle still in frame. No fake testimonials.`,
          audienceBenefit: `${audience} should feel a scene they recognize, with ${product} still visible.`,
          creativeDirection: `Hands, collarbone, table, bottle. The named product stays readable. Do not invent a celebrity or a crowd.`,
          recommendedFormat: formatFor("lifestyle", pref),
          cta: `Wear ${product}`,
        }
      : {
          id: "lifestyle",
          lane: "lifestyle",
          title: "The moment",
          hook: brand && place ? `A real moment in ${place}` : `A pause that actually feels like one`,
          coreMessage: brand
            ? `${brand} as the place you sit — ${product} in a shared moment, not a flyer.`
            : `${product} in a shared moment, not a flyer.`,
          audienceBenefit: `${audience} should feel a place they want to be, with ${product} still in frame.`,
          creativeDirection: `Hands, table, people around the named ${product}. No fake quotes.`,
          recommendedFormat: formatFor("lifestyle", pref),
          cta: `Make ${product} part of the day`,
        };

  const concepts = [sensory, offerConcept, lifestyle];
  const hasOffer = Boolean(offer);
  const wantsOrders = conversion(input.facts.objective);
  let recommendedId: ConceptLane = "appetite";
  let recommendationReason =
    lane === "fragrance"
      ? "I’d use The scent. We only have the product as given; hunger-style food language would be dishonest here."
      : "I’d use the product-led direction. We have no need to invent a story.";
  if (hasOffer && wantsOrders) {
    recommendedId = "offer";
    recommendationReason = `I’d use The offer. You already have a real price (${offer}) and you want a commercial result — lead with that.`;
  } else if (!hasOffer && wantsOrders) {
    recommendedId = "offer";
    recommendationReason =
      "I’d use The offer. You want a concrete action, and we still will not invent a price.";
  } else if (lane === "fragrance" && !hasOffer) {
    recommendedId = "appetite";
    recommendationReason = `I’d use The scent. There is no verified price, so the bottle itself is the honest opening for ${product}.`;
  } else if (!hasOffer && !wantsOrders) {
    recommendedId = "lifestyle";
    recommendationReason = `I’d use The moment. There is no verified price to shout, so a lived scene around ${product} is the stronger honest path.`;
  }

  return {
    concepts,
    recommendedId,
    recommendationReason,
    selectedId: null,
    chosenBy: null,
  };
}

export function conceptIntro(language: "en" | "ar", set: ConceptSet): string {
  if (language === "ar") {
    return `جهّزت ثلاثة اتجاهات مختلفة. ${set.recommendationReason} اختر واحداً، أو اتركني أختار.`;
  }
  return `I prepared three different directions. ${set.recommendationReason} Pick one, or let me choose.`;
}

export function isConceptSet(value: unknown): value is ConceptSet {
  if (!value || typeof value !== "object") return false;
  const data = value as ConceptSet;
  return Array.isArray(data.concepts) && data.concepts.length > 0;
}
