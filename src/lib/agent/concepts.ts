import type {
  Business,
  CampaignFacts,
  ConceptSet,
  MarketingConcept,
  MarketingPlan,
} from "../types";
import { planStrategies } from "./strategies";

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
  const performanceOnFile = input.plan.measuredInsights.some((item) => item.available);
  const planned = planStrategies({
    business: input.business,
    facts: input.facts,
    prompt: input.prompt,
    history: input.plan.history,
    performanceOnFile,
  });
  const concepts: MarketingConcept[] = planned.strategies.map((strategy) => ({
    id: strategy.id,
    lane: strategy.id,
    title: strategy.title,
    hook: strategy.hook,
    headline: strategy.headline,
    supportingCopy: strategy.supportingCopy,
    coreMessage: strategy.supportingCopy,
    audienceBenefit: strategy.benefit,
    creativeDirection: strategy.visualConcept,
    recommendedFormat: strategy.format,
    cta: strategy.cta,
  }));
  const recommendedId = planned.recommendedId;
  const recommendationReason = planned.reason;

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
