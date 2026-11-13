import "server-only";

import { getLlmProvider, interpreterLabel } from "../conversation/llm";
import type {
  Business,
  CampaignFacts,
  ConceptSet,
  HistoryItem,
  MarketingPlan,
  MemoryEntry,
} from "../types";
import { emptyConceptSet } from "./concepts";
import { brandForCopy, relevantHistory, reuseFromHistory, withoutForeignBrand } from "./context";
import { frameworkById } from "./knowledge";
import {
  consultKnowledgeBase,
  proposeConceptsTool,
  retrieveBusinessProfile,
  retrieveCampaignHistoryTool,
  retrieveMemoryTool,
  selectMarketingStrategy,
  writeCopy,
  type ToolName,
  type ToolResult,
} from "./tools";

export type AgentRun = {
  plan: MarketingPlan;
  concepts: ConceptSet;
  trace: ToolResult[];
};

export { reuseFromHistory } from "./context";

export async function runMarketingAgent(input: {
  customerId: string;
  business: Business;
  facts: CampaignFacts;
  prompt: string;
  history: HistoryItem[];
  reusedFromHistory: string[];
  historyNote?: string;
}): Promise<AgentRun> {
  const trace: ToolResult[] = [];
  const profile = retrieveBusinessProfile(input.business);
  trace.push(profile);
  const scopedHistory = relevantHistory(input.history, input.prompt, input.facts.productName);
  const historyTool = retrieveCampaignHistoryTool(scopedHistory);
  trace.push(historyTool);
  const memoryTool = await retrieveMemoryTool(input.customerId, input.business.id);
  trace.push(memoryTool);
  const knowledge = consultKnowledgeBase({
    facts: input.facts,
    business: input.business,
    prompt: input.prompt,
  });
  trace.push(knowledge);
  if (!knowledge.ok) {
    return { plan: emptyPlan(input, trace, []), concepts: emptyConceptSet(), trace };
  }
  const strategy = selectMarketingStrategy({
    facts: input.facts,
    business: input.business,
    prompt: input.prompt,
    knowledge: knowledge.data,
  });
  trace.push(strategy);
  if (!strategy.ok) {
    return {
      plan: emptyPlan(input, trace, memoryTool.ok ? memoryTool.data : []),
      concepts: emptyConceptSet(),
      trace,
    };
  }
  const copy = writeCopy({
    facts: input.facts,
    business: input.business,
    strategy: strategy.data,
    prompt: input.prompt,
  });
  trace.push(copy);

  const provider = getLlmProvider();
  const brandInput = {
    prompt: input.prompt,
    productName: input.facts.productName,
    business: input.business,
  };
  let hooks = copy.ok ? copy.data.hooks : [];
  let cta = copy.ok ? copy.data.cta : "";
  let creativeDirection = copy.ok ? copy.data.creativeDirection : "";
  let orchestrator = interpreterLabel(provider) === "structured" ? "structured" : interpreterLabel(provider);
  if (provider.isConfigured() && "plan" in provider && typeof provider.plan === "function") {
    try {
      const llm = await (
        provider as { plan: (payload: unknown) => Promise<{ hooks?: string[]; cta?: string; frameworkId?: string } | null> }
      ).plan({
        facts: input.facts,
        businessName: brandForCopy(brandInput),
        productName: input.facts.productName,
        frameworkId: strategy.data.framework.id,
      });
      if (llm?.hooks?.length) {
        hooks = llm.hooks
          .filter((line) => !inventsMetrics(line))
          .map((line) => withoutForeignBrand(line, brandInput));
      }
      if (llm?.cta && !inventsMetrics(llm.cta)) cta = withoutForeignBrand(llm.cta, brandInput);
      if (llm?.frameworkId && frameworkById(llm.frameworkId)) {
        /* keep structured winner; LLM may only refine copy */
      }
    } catch {
      orchestrator = "structured";
    }
  } else {
    orchestrator = "structured";
  }

  const memory: MemoryEntry[] = memoryTool.ok ? memoryTool.data : [];
  const verifiedFacts = verifiedFrom(input.business, input.facts, input.prompt);
  const preferences: MarketingPlan["preferences"] = [];
  if (input.facts.formatPreference) {
    preferences.push({ label: "Format", value: input.facts.formatPreference });
  }
  const hypotheses = buildHypotheses(input.facts, scopedHistory, strategy.data.framework.name);
  const missing: string[] = [];
  if (!input.facts.productName) missing.push("productName");
  if (!input.facts.objective) missing.push("objective");
  if (!input.facts.offer) missing.push("offer");

  const plan: MarketingPlan = {
    objective: input.facts.objective,
    verifiedFacts,
    preferences,
    history: scopedHistory,
    measuredInsights: measuredFrom(memory),
    hypotheses,
    audience: strategy.data.audience,
    angle: strategy.data.angle,
    framework: {
      id: strategy.data.framework.id,
      name: strategy.data.framework.name,
      reason: strategy.data.reason,
    },
    hooks,
    creativeDirection,
    cta,
    missing,
    evidence: evidenceLines(input.business, input.facts, scopedHistory, memory, input.historyNote),
    toolsUsed: usedTools(trace),
    orchestrator,
    reusedFromHistory: input.reusedFromHistory,
    historyNote:
      input.historyNote ||
      (scopedHistory.length
        ? `Used ${scopedHistory.length} earlier brief(s) for this product.`
        : "Did not reuse earlier briefs — different product or none on file."),
  };

  const conceptsTool = proposeConceptsTool({
    business: input.business,
    facts: input.facts,
    plan,
    prompt: input.prompt,
  });
  trace.push(conceptsTool);
  plan.toolsUsed = usedTools(trace);
  const concepts = conceptsTool.ok ? conceptsTool.data : emptyConceptSet();

  return { plan, concepts, trace };
}

export function emptyPlan(
  input: {
    facts: CampaignFacts;
    history: HistoryItem[];
    reusedFromHistory: string[];
    historyNote?: string;
  },
  trace: ToolResult[],
  _memory: MemoryEntry[],
): MarketingPlan {
  return {
    objective: input.facts.objective,
    verifiedFacts: [],
    preferences: [],
    history: input.history,
    measuredInsights: [
      {
        label: "Campaign performance",
        value: "None on file.",
        available: false,
      },
    ],
    hypotheses: [],
    audience: "",
    angle: "",
    framework: null,
    hooks: [],
    creativeDirection: "",
    cta: "",
    missing: [],
    evidence: [],
    toolsUsed: usedTools(trace),
    orchestrator: "structured",
    reusedFromHistory: input.reusedFromHistory,
    historyNote: input.historyNote ?? "",
  };
}

function usedTools(trace: ToolResult[]): string[] {
  return trace.filter((item) => item.ok).map((item) => item.tool as ToolName);
}

function inventsMetrics(text: string): boolean {
  return /\d+\s*%|\bROI\b|impressions|went viral|best[- ]selling/i.test(text);
}

function measuredFrom(memory: MemoryEntry[]): MarketingPlan["measuredInsights"] {
  const insights = memory.filter((item) => item.kind === "measured_insight" || item.kind === "instagram_observation");
  if (insights.length === 0) {
    return [
      {
        label: "Campaign performance",
        value: "None on file. Approval of a brief is not a result. Instagram likes are not sales.",
        available: false,
      },
    ];
  }
  return insights.slice(0, 6).map((item) => ({
    label: item.label,
    value: item.value,
    available: item.kind === "measured_insight",
  }));
}

function verifiedFrom(business: Business, facts: CampaignFacts, prompt: string): MarketingPlan["verifiedFacts"] {
  const rows: MarketingPlan["verifiedFacts"] = [];
  if (business.name) rows.push({ fact: `Business: ${business.name}`, source: "Business profile" });
  if (facts.productName) rows.push({ fact: `Product: ${facts.productName}`, source: "Customer brief" });
  if (facts.offer) rows.push({ fact: `Offer: ${facts.offer}`, source: "Customer brief" });
  if (facts.objective) rows.push({ fact: `Objective: ${facts.objective}`, source: "Customer brief" });
  if (business.location) rows.push({ fact: `Location: ${business.location}`, source: "Business profile" });
  if (business.productsServices) {
    rows.push({ fact: `Products: ${business.productsServices}`, source: "Business profile" });
  }
  if (facts.audienceNote) {
    rows.push({ fact: `Audience: ${facts.audienceNote}`, source: "Customer brief" });
  }
  if (prompt) rows.push({ fact: `Original request kept on file`, source: "Customer prompt" });
  return rows;
}

function buildHypotheses(
  facts: CampaignFacts,
  history: HistoryItem[],
  frameworkName: string,
): MarketingPlan["hypotheses"] {
  const rows: MarketingPlan["hypotheses"] = [];
  rows.push({
    claim: `${frameworkName} is a reasonable fit for this brief.`,
    basis: "Chosen from the knowledge base against verified facts, not from measured results.",
  });
  if (history.length > 0 && facts.offer && history.some((item) => item.offer === facts.offer)) {
    rows.push({
      claim: "Repeating the same verified offer may need a different angle later.",
      basis: "A previous brief already used this offer. This is an assumption, not performance data.",
    });
  }
  return rows;
}

function evidenceLines(
  business: Business,
  facts: CampaignFacts,
  history: HistoryItem[],
  memory: MemoryEntry[],
  historyNote?: string,
): string[] {
  const lines = [
    `Profile ${business.name || "(unnamed)"} loaded`,
    historyNote || `${history.length} prior campaign record(s) in the same product context`,
    `${memory.filter((item) => item.kind === "verified_fact").length} stored verified fact(s)`,
    `${memory.filter((item) => item.kind === "instagram_observation").length} customer-approved Instagram observation(s)`,
    `${memory.filter((item) => item.kind === "measured_insight").length} measured insight(s) — none invented`,
  ];
  if (facts.offer) lines.push(`Offer taken from the customer, not estimated`);
  const ig = memory.find((item) => item.kind === "instagram_observation");
  if (ig) lines.push("New ads must be original. Do not copy old Instagram captions.");
  return lines;
}

export function planSummary(language: "en" | "ar", plan: MarketingPlan, businessName: string): string {
  const framework = plan.framework?.name ?? (language === "ar" ? "نهج بسيط" : "a simple approach");
  const history = plan.historyNote
    ? ` ${plan.historyNote}`
    : plan.history.length > 0
      ? language === "ar"
        ? ` رجعت إلى ${plan.history.length} ملخصاً سابقاً لنفس المنتج.`
        : ` I used ${plan.history.length} earlier brief(s) for the same product at ${businessName}.`
      : language === "ar"
        ? " لم أنسخ حملة سابقة."
        : " I did not copy a previous campaign.";
  const reused =
    plan.reusedFromHistory.length > 0
      ? language === "ar"
        ? ` أعدت استخدام: ${plan.reusedFromHistory.join("، ")}.`
        : ` Reused from history: ${plan.reusedFromHistory.join(", ")}.`
      : "";
  const performance = plan.measuredInsights.some((item) => item.available)
    ? language === "ar"
      ? " توجد نتائج حملات محفوظة."
      : " Measured campaign results are on file."
    : language === "ar"
      ? " لا توجد نتائج أداء محفوظة. الإعجابات ليست مبيعات."
      : " No performance results are on file. Likes are not sales.";
  if (language === "ar") {
    return `اخترت «${framework}» لأن ${plan.framework?.reason ?? "هذا ما تدعمه الحقائق"}.${history}${reused}${performance}`;
  }
  return `I chose ${framework} because ${plan.framework?.reason ?? "that is what the facts support."}${history}${reused}${performance}`;
}
