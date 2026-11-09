import type { Business, Campaign, CampaignFacts, ConceptLane, HistoryItem } from "../types";

export type AdStrategy = {
  id: ConceptLane;
  title: string;
  hook: string;
  headline: string;
  supportingCopy: string;
  visualConcept: string;
  benefit: string;
  cta: string;
  format: "image" | "video";
};

export type StrategyPlan = {
  strategies: [AdStrategy, AdStrategy, AdStrategy];
  recommendedId: ConceptLane;
  reason: string;
};

export function planStrategies(input: {
  business: Business;
  facts: CampaignFacts;
  prompt?: string;
  history?: HistoryItem[];
  performanceOnFile?: boolean;
}): StrategyPlan {
  const subject = subjectOf(input.facts, input.business, input.prompt ?? "");
  const audience = audienceOf(input.facts, input.business);
  const place = input.business.location.trim();
  const offer = verifiedOffer(input.facts.offer);
  const objective = input.facts.objective?.trim() || `Promote ${subject}`;
  const earlier = relevantEarlier(input.history ?? [], subject);
  const performance = input.performanceOnFile === true;
  const cta = actionLine(objective, subject, input.business.name, offer);
  const where = place ? ` in ${place}` : "";
  const avoid = earlier
    ? ` This must look different from the earlier ad for ${earlier.productName || subject}, which was aimed at ${earlier.objective || "another goal"}.`
    : "";

  const proof: AdStrategy = {
    id: "appetite",
    title: "Show the work",
    hook: `See ${subject} before you decide.`,
    headline: clip(subject, 42),
    supportingCopy: clip(input.business.description.trim() || input.business.productsServices.trim() || `${input.business.name} delivers ${subject}.`, 110),
    visualConcept: `A truthful photograph of ${subject} as ${input.business.name} actually delivers it${where}. The work or product fills the frame and the background stays quiet.${avoid} No text, no letters, no numbers, no logo, no watermark.`,
    benefit: `${audience} can judge ${subject} from the thing itself.`,
    cta,
    format: formatFor("appetite", input.facts.formatPreference),
  };

  const customer: AdStrategy = {
    id: "lifestyle",
    title: "The customer's moment",
    hook: `${clip(audience, 48)} already know this moment.`,
    headline: clip(`For ${shortAudience(audience)}`, 42),
    supportingCopy: clip(`${audience} should recognize the moment they need ${subject}.`, 110),
    visualConcept: `A photograph of one person from ${audience} at the moment they need ${subject}, in an ordinary place, before they reach ${input.business.name}. The need is visible. No crowd, no meeting, no poster.${avoid} No text, no letters, no numbers, no logo, no watermark.`,
    benefit: `${audience} should feel the picture is about their situation, not a generic stock scene.`,
    cta,
    format: formatFor("lifestyle", input.facts.formatPreference),
  };

  const decision: AdStrategy = {
    id: "offer",
    title: offer ? "The verified offer" : "The next step",
    hook: offer ? `${offer} is the only price in this ad.` : "One clear next step. No invented discount.",
    headline: clip(decisionHeadline(objective, subject), 42),
    supportingCopy: offer
      ? clip(`Verified offer: ${offer}. Nothing else is added.`, 110)
      : clip(`No verified price is on file, so the ad does not invent one.`, 110),
    visualConcept: `A photograph of the instant one customer commits to ${subject} at ${input.business.name}${where}. One person, one action, the service visible. No crowd and no meeting.${avoid} No text, no letters, no numbers, no logo, no watermark.`,
    benefit: offer
      ? `${audience} see ${offer} and a single way to act.`
      : `${audience} know the next step without a made-up price.`,
    cta,
    format: formatFor("offer", input.facts.formatPreference),
  };

  const strategies: [AdStrategy, AdStrategy, AdStrategy] = [proof, customer, decision];
  const recommendedId = recommend(input.facts, Boolean(offer), Boolean(earlier));
  const reason = [
    performance
      ? "Past campaign results are on file and were used in this choice."
      : "No measured campaign results are on file, so this choice comes from the brief and earlier briefs, not from ad performance.",
    recommendedId === "offer"
      ? offer
        ? `I recommend The verified offer because ${offer} is real and the goal is a concrete action.`
        : "I recommend The next step because you want a concrete action and there is no verified price to invent."
      : recommendedId === "lifestyle"
        ? "I recommend The customer's moment so this ad does not repeat the earlier one."
        : `I recommend Show the work so ${audience} can see ${subject} itself.`,
  ].join(" ");

  return { strategies, recommendedId, reason };
}

export function photographBrief(campaign: Pick<Campaign, "productName" | "offer" | "objective" | "audienceNote" | "formatPreference" | "originalPrompt" | "conceptSet">, business: Business): string {
  const selected = campaign.conceptSet?.concepts.find((item) => item.id === campaign.conceptSet?.selectedId);
  const stored = selected?.creativeDirection?.trim() ?? "";
  if (stored && !unsafeVisual(stored)) return stored;
  const plan = planStrategies({
    business,
    facts: {
      productName: campaign.productName,
      offer: campaign.offer,
      objective: campaign.objective,
      formatPreference: campaign.formatPreference,
      existingPhotosNote: null,
      mustAppear: null,
      audienceNote: campaign.audienceNote,
    },
    prompt: campaign.originalPrompt,
  });
  const lane = selected?.id ?? plan.recommendedId;
  return plan.strategies.find((item) => item.id === lane)?.visualConcept ?? plan.strategies[0].visualConcept;
}

export function selectedCopy(campaign: Pick<Campaign, "productName" | "offer" | "conceptSet">, business: Business): {
  headline: string;
  supportingCopy: string;
  offer: string | null;
  cta: string;
} {
  const selected = campaign.conceptSet?.concepts.find((item) => item.id === campaign.conceptSet?.selectedId);
  return {
    headline: clip(selected?.headline || selected?.hook || campaign.productName || business.name, 42),
    supportingCopy: clip(selected?.supportingCopy || selected?.coreMessage || business.productsServices || business.name, 110),
    offer: verifiedOffer(campaign.offer),
    cta: clip(selected?.cta || `Choose ${campaign.productName || business.name}`, 32),
  };
}

function subjectOf(facts: CampaignFacts, business: Business, prompt: string): string {
  const named = facts.productName?.trim() ?? "";
  if (named && !/^(the\s+)?(offer|offering|product|item|ad|advertisement)s?$/i.test(named)) return named;
  const listed = business.productsServices.split(/[,;\n]/).map((part) => part.trim()).find((part) => part.length >= 3);
  if (listed) return listed;
  const cleaned = prompt.replace(/^(please\s+)?(i\s+want\s+to\s+)?(promote|advertise|sell)\s+/i, "").trim();
  return cleaned.slice(0, 80) || business.name;
}

function audienceOf(facts: CampaignFacts, business: Business): string {
  return facts.audienceNote?.trim() || business.targetCustomers.trim() || "the people this business already serves";
}

function shortAudience(audience: string): string {
  return clip(audience.replace(/^the\s+/i, ""), 28);
}

function verifiedOffer(offer: string | null): string | null {
  const text = offer?.trim() ?? "";
  if (!text || /^(none|n\/a|no offer|skip)$/i.test(text)) return null;
  return text;
}

function relevantEarlier(history: HistoryItem[], subject: string): HistoryItem | null {
  const needle = subject.toLowerCase();
  return history.find((item) => {
    const name = item.productName?.toLowerCase() ?? "";
    return name && (name.includes(needle) || needle.includes(name));
  }) ?? null;
}

function actionLine(objective: string, subject: string, business: string, offer: string | null): string {
  const text = objective.toLowerCase();
  if (/order|sales|طلب|مبيعات/.test(text)) return offer ? `Order now` : `Order ${clip(subject, 18)}`;
  if (/book|appoint|حجز/.test(text)) return `Book ${clip(subject, 22)}`;
  if (/inquir|lead|استفسار/.test(text)) return `Ask about ${clip(subject, 18)}`;
  if (/visit|footfall|زيار/.test(text)) return `Visit ${clip(business, 18)}`;
  if (/aware|وعي/.test(text)) return `See ${clip(subject, 24)}`;
  return offer ? `Get this offer` : `Choose ${clip(subject, 18)}`;
}

function decisionHeadline(objective: string, subject: string): string {
  const text = objective.toLowerCase();
  if (/book|appoint|حجز/.test(text)) return `Book ${subject}`;
  if (/order|sales|طلب|مبيعات/.test(text)) return `Order ${subject}`;
  if (/visit|زيار/.test(text)) return `Come for ${subject}`;
  if (/inquir|lead|استفسار/.test(text)) return `Ask about ${subject}`;
  return subject;
}

function formatFor(lane: ConceptLane, preference: CampaignFacts["formatPreference"]): "image" | "video" {
  if (preference === "image") return "image";
  if (preference === "video" || preference === "both") return "video";
  return lane === "lifestyle" ? "video" : "image";
}

function recommend(facts: CampaignFacts, hasOffer: boolean, hasEarlier: boolean): ConceptLane {
  const objective = facts.objective ?? "";
  const wantsAction = /order|sales|book|appoint|inquir|lead|visit|طلب|مبيعات|حجز|استفسار|زيار/i.test(objective);
  if (hasOffer && wantsAction) return "offer";
  if (!hasOffer && wantsAction) return "offer";
  if (hasEarlier) return "lifestyle";
  return "appetite";
}

function unsafeVisual(text: string): boolean {
  return /exact text|typeset|boardroom|people around|paint|price overlay|must read/i.test(text);
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/\s+\S*$/, "").trim() || clean.slice(0, max - 1)}…`;
}
