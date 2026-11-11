import "server-only";

import { conceptIntro, emptyConceptSet, isConceptSet } from "../agent/concepts";
import { relevantHistory } from "../agent/context";
import { emptyPlan, planSummary, reuseFromHistory, runMarketingAgent } from "../agent/orchestrator";
import {
  applyFieldAnswer,
  ask,
  awaitingFromFacts,
  briefingFields,
  buildBrief,
  campaignFields,
  greeting,
  interpretCampaignPrompt,
  isSkip,
  message,
  nextMissing,
  summaryPrompt,
} from "../conversation/engine";
import { maybeRefreshInsights, listPublicationsForCustomer } from "../instagram/publications";
import { importMissingFalVideo, listCreatives } from "./creatives";
import { hasProductPhoto } from "../media/brand-assets";
import { redactFalMessage } from "../media/fal-key";
import { buildMediaQuote, falKeyConfigured } from "../media/quote";
import { emptyFacts } from "../conversation/extract";
import { newId } from "../crypto";
import { parseJson, sql } from "../db";
import { rememberConfirmedBrief } from "./memory";
import type {
  Business,
  Campaign,
  CampaignFacts,
  CampaignStatus,
  ChatMessage,
  FormatPreference,
  HistoryItem,
  InterpretedBrief,
  Language,
  MarketingPlan,
  ConceptSet,
  ConceptLane,
  GenerationStatus,
} from "../types";

type CampaignRow = {
  id: string;
  customer_id: string;
  business_id: string;
  status: CampaignStatus;
  original_prompt: string;
  product_name: string | null;
  offer: string | null;
  objective: string | null;
  format_preference: FormatPreference | null;
  existing_photos_note: string | null;
  must_appear: string | null;
  conversation: unknown;
  interpreted_brief: unknown;
  marketing_plan: unknown;
  concept_set: unknown;
  interpreter: string;
  audience_note: string | null;
  generation_status?: GenerationStatus;
  generation_note?: string;
  paid_image_count?: number;
  paid_video_count?: number;
  created_at: string;
  updated_at: string;
  business_name?: string;
};

function factsFromRow(row: CampaignRow): CampaignFacts {
  return {
    productName: row.product_name,
    offer: row.offer,
    objective: row.objective,
    formatPreference: row.format_preference,
    existingPhotosNote: row.existing_photos_note,
    mustAppear: row.must_appear,
    audienceNote: row.audience_note,
  };
}

function mapCampaign(row: CampaignRow): Campaign {
  const facts = factsFromRow(row);
  const conversation = parseJson<ChatMessage[]>(row.conversation, []);
  const brief = parseJson<InterpretedBrief | Record<string, never>>(row.interpreted_brief, {});
  const plan = parseJson<MarketingPlan | Record<string, never>>(row.marketing_plan, {});
  const conceptSet = isConceptSet(parseJson(row.concept_set, {}))
    ? (parseJson(row.concept_set, {}) as ConceptSet)
    : null;
  const briefName = "businessName" in brief ? brief.businessName : "";
  const awaiting =
    row.status === "drafting"
      ? awaitingFromFacts(facts, row.original_prompt)
      : row.status === "brief_ready"
        ? "summary"
        : null;
  const paidImageCount = Number(row.paid_image_count ?? 0);
  const paidVideoCount = Number(row.paid_video_count ?? 0);
  return {
    id: row.id,
    customerId: row.customer_id,
    businessId: row.business_id,
    businessName: row.business_name || briefName || undefined,
    status: row.status,
    originalPrompt: row.original_prompt,
    ...facts,
    conversation,
    interpretedBrief: brief,
    marketingPlan: "framework" in plan || "verifiedFacts" in plan ? (plan as MarketingPlan) : null,
    conceptSet,
    creatives: [],
    publications: [],
    generationStatus: row.generation_status || "not_started",
    generationNote: redactFalMessage(row.generation_note || ""),
    paidImageCount,
    paidVideoCount,
    mediaQuote: buildMediaQuote({
      campaign: {
        formatPreference: facts.formatPreference,
        conceptSet,
        paidImageCount,
        paidVideoCount,
      },
      keyConfigured: falKeyConfigured(),
    }),
    interpreter: row.interpreter,
    awaiting,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function persist(row: {
  id: string;
  customerId: string;
  status: CampaignStatus;
  originalPrompt: string;
  facts: CampaignFacts;
  conversation: ChatMessage[];
  brief: InterpretedBrief | Record<string, never>;
  plan: MarketingPlan | Record<string, never>;
  conceptSet?: ConceptSet | Record<string, never>;
  interpreter: string;
}) {
  await sql(
    `update campaigns set
       status = $3,
       original_prompt = $4,
       product_name = $5,
       offer = $6,
       objective = $7,
       format_preference = $8,
       existing_photos_note = $9,
       must_appear = $10,
       audience_note = $16,
       conversation = $11::jsonb,
       interpreted_brief = $12::jsonb,
       marketing_plan = $13::jsonb,
       interpreter = $14,
       concept_set = coalesce($15::jsonb, concept_set),
       updated_at = now()
     where id = $1 and customer_id = $2`,
    [
      row.id,
      row.customerId,
      row.status,
      row.originalPrompt,
      row.facts.productName,
      row.facts.offer,
      row.facts.objective,
      row.facts.formatPreference,
      row.facts.existingPhotosNote,
      row.facts.mustAppear,
      JSON.stringify(row.conversation),
      JSON.stringify(row.brief),
      JSON.stringify(row.plan ?? {}),
      row.interpreter,
      row.conceptSet === undefined ? null : JSON.stringify(row.conceptSet ?? {}),
      row.facts.audienceNote ?? null,
    ],
  );
  return loadCampaign(row.customerId, row.id);
}

async function loadCampaign(customerId: string, id: string): Promise<Campaign> {
  const rows = await sql<CampaignRow>(
    `select c.*, b.name as business_name
     from campaigns c
     join businesses b on b.id = c.business_id
     where c.id = $1 and c.customer_id = $2
     limit 1`,
    [id, customerId],
  );
  const campaign = mapCampaign(rows[0]);
  campaign.creatives = await listCreatives(customerId, id);
  const publications = await listPublicationsForCustomer(customerId, [id]);
  campaign.publications = await maybeRefreshInsights(publications.get(id) ?? []);
  return campaign;
}

export async function listCampaignHistory(
  customerId: string,
  businessId: string,
  excludeId?: string,
): Promise<HistoryItem[]> {
  const rows = await sql<{
    id: string;
    product_name: string | null;
    offer: string | null;
    objective: string | null;
    status: CampaignStatus;
    original_prompt: string;
    created_at: string;
  }>(
    excludeId
      ? `select id, product_name, offer, objective, status, original_prompt, created_at
         from campaigns
         where customer_id = $1 and business_id = $2 and id <> $3
         order by updated_at desc
         limit 12`
      : `select id, product_name, offer, objective, status, original_prompt, created_at
         from campaigns
         where customer_id = $1 and business_id = $2
         order by updated_at desc
         limit 12`,
    excludeId ? [customerId, businessId, excludeId] : [customerId, businessId],
  );
  return rows.map((row) => ({
    campaignId: row.id,
    productName: row.product_name,
    offer: row.offer,
    objective: row.objective,
    status: row.status,
    originalPrompt: row.original_prompt,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

async function readyPlan(input: {
  customerId: string;
  business: Business;
  facts: CampaignFacts;
  prompt: string;
  history: HistoryItem[];
  reused: string[];
  historyNote?: string;
  language: Language;
  conversation: ChatMessage[];
}): Promise<{
  brief: InterpretedBrief;
  plan: MarketingPlan;
  concepts: ConceptSet;
  conversation: ChatMessage[];
  interpreter: string;
}> {
  const run = await runMarketingAgent({
    customerId: input.customerId,
    business: input.business,
    facts: input.facts,
    prompt: input.prompt,
    history: input.history,
    reusedFromHistory: input.reused,
    historyNote: input.historyNote,
  });
  const brief = buildBrief(input.business, input.facts, input.prompt, run.plan.orchestrator);
  const conversation = [
    ...input.conversation,
    summaryPrompt(input.language),
    message("agent", planSummary(input.language, run.plan, input.business.name)),
    message("agent", conceptIntro(input.language, run.concepts)),
  ];
  return {
    brief,
    plan: run.plan,
    concepts: run.concepts,
    conversation,
    interpreter: run.plan.orchestrator,
  };
}

export async function listCampaigns(customerId: string): Promise<Campaign[]> {
  const rows = await sql<CampaignRow>(
    `select c.*, b.name as business_name
     from campaigns c
     join businesses b on b.id = c.business_id
     where c.customer_id = $1
     order by c.updated_at desc`,
    [customerId],
  );
  const campaigns = rows.map(mapCampaign);
  const publications = await listPublicationsForCustomer(
    customerId,
    campaigns.map((item) => item.id),
  );
  for (const campaign of campaigns) {
    campaign.publications = publications.get(campaign.id) ?? [];
  }
  return campaigns;
}

export async function getCampaign(customerId: string, id: string) {
  const rows = await sql<CampaignRow>(
    `select c.*, b.name as business_name
     from campaigns c
     join businesses b on b.id = c.business_id
     where c.id = $1 and c.customer_id = $2
     limit 1`,
    [id, customerId],
  );
  if (!rows[0]) return null;
  const campaign = mapCampaign(rows[0]);
  if (await hasProductPhoto(customerId, campaign.businessId)) {
    campaign.mediaQuote = buildMediaQuote({
      campaign,
      keyConfigured: falKeyConfigured(),
      hasReferencePhoto: true,
    });
  }
  campaign.creatives = await listCreatives(customerId, id);
  if (await importMissingFalVideo(campaign)) return getCampaign(customerId, id);
  const publications = await listPublicationsForCustomer(customerId, [id]);
  campaign.publications = await maybeRefreshInsights(publications.get(id) ?? []);
  return campaign;
}

export async function startCampaign(input: {
  customerId: string;
  business: Business;
  prompt: string;
  language: Language;
}): Promise<Campaign> {
  const history = await listCampaignHistory(input.customerId, input.business.id);
  const interpreted = await interpretCampaignPrompt({
    prompt: input.prompt,
    business: input.business,
    language: input.language,
  });
  const { facts, reused, historyNote } = reuseFromHistory(interpreted.facts, history, input.prompt);
  const interpreter = interpreted.interpreter;
  const related = relevantHistory(history, input.prompt, facts.productName);
  const historyLine = related.length
    ? input.language === "ar"
      ? ` سأستخدم الملخص السابق لنفس المنتج: ${[related[0].productName, related[0].offer, related[0].objective].filter(Boolean).join(" · ")}.`
      : ` I’ll reuse the earlier brief for the same product: ${[related[0].productName, related[0].offer, related[0].objective].filter(Boolean).join(" · ")}.`
    : historyNote
      ? ` ${historyNote}`
      : "";
  const conversation: ChatMessage[] = [
    greeting(input.language, input.business.name || "your business", historyLine, input.prompt),
    message("customer", input.prompt),
  ];
  const missing = nextMissing(briefingFields(input.prompt), facts as unknown as Record<string, unknown>);
  let status: CampaignStatus = "drafting";
  let brief: InterpretedBrief | Record<string, never> = {};
  let plan: MarketingPlan | Record<string, never> = emptyPlan(
    { facts, history: related, reusedFromHistory: reused, historyNote },
    [],
    [],
  );
  let concepts: ConceptSet | Record<string, never> = emptyConceptSet();
  let nextConversation = conversation;
  let nextInterpreter = interpreter;
  if (missing) {
    nextConversation = [...conversation, ask(missing, input.language)];
  } else {
    status = "brief_ready";
    const ready = await readyPlan({
      customerId: input.customerId,
      business: input.business,
      facts,
      prompt: input.prompt,
      history,
      reused,
      historyNote,
      language: input.language,
      conversation,
    });
    brief = ready.brief;
    plan = ready.plan;
    concepts = ready.concepts;
    nextConversation = ready.conversation;
    nextInterpreter = ready.interpreter;
  }
  const id = newId();
  await sql(
    `insert into campaigns (
       id, customer_id, business_id, status, original_prompt,
       product_name, offer, objective, format_preference,
       existing_photos_note, must_appear, audience_note, conversation, interpreted_brief, marketing_plan, interpreter, concept_set
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16,$17::jsonb)`,
    [
      id,
      input.customerId,
      input.business.id,
      status,
      input.prompt,
      facts.productName,
      facts.offer,
      facts.objective,
      facts.formatPreference,
      facts.existingPhotosNote,
      facts.mustAppear,
      facts.audienceNote,
      JSON.stringify(nextConversation),
      JSON.stringify(brief),
      JSON.stringify(plan),
      nextInterpreter,
      JSON.stringify(concepts),
    ],
  );
  return loadCampaign(input.customerId, id);
}

export async function continueCampaign(input: {
  campaign: Campaign;
  business: Business;
  text: string;
  skip: boolean;
  skipRemaining?: boolean;
  language: Language;
}): Promise<Campaign> {
  if (input.campaign.status !== "drafting") return input.campaign;
  const facts = {
    productName: input.campaign.productName,
    offer: input.campaign.offer,
    objective: input.campaign.objective,
    formatPreference: input.campaign.formatPreference,
    existingPhotosNote: input.campaign.existingPhotosNote,
    mustAppear: input.campaign.mustAppear,
    audienceNote: input.campaign.audienceNote,
  };
  const fields = campaignFields(input.campaign.originalPrompt);
  const awaiting = awaitingFromFacts(facts, input.campaign.originalPrompt);
  const field = fields.find((item) => item.key === awaiting);
  const conversation = [...input.campaign.conversation];
  const userText = input.text.trim();

  const history = await listCampaignHistory(
    input.campaign.customerId,
    input.business.id,
    input.campaign.id,
  );

  if (input.skipRemaining && facts.productName && facts.objective) {
    conversation.push(
      message("customer", input.language === "ar" ? "تخطي الباقي" : "Skip remaining", undefined, true),
    );
    const ready = await readyPlan({
      customerId: input.campaign.customerId,
      business: input.business,
      facts,
      prompt: input.campaign.originalPrompt,
      history,
      reused: input.campaign.marketingPlan?.reusedFromHistory ?? [],
      historyNote: input.campaign.marketingPlan?.historyNote,
      language: input.language,
      conversation,
    });
    return persist({
      id: input.campaign.id,
      customerId: input.campaign.customerId,
      status: "brief_ready",
      originalPrompt: input.campaign.originalPrompt,
      facts,
      conversation: ready.conversation,
      brief: ready.brief,
      plan: ready.plan,
      conceptSet: ready.concepts,
      interpreter: ready.interpreter,
    });
  }

  if (!field) {
    const ready = await readyPlan({
      customerId: input.campaign.customerId,
      business: input.business,
      facts,
      prompt: input.campaign.originalPrompt,
      history,
      reused: input.campaign.marketingPlan?.reusedFromHistory ?? [],
      historyNote: input.campaign.marketingPlan?.historyNote,
      language: input.language,
      conversation,
    });
    return persist({
      id: input.campaign.id,
      customerId: input.campaign.customerId,
      status: "brief_ready",
      originalPrompt: input.campaign.originalPrompt,
      facts,
      conversation: ready.conversation,
      brief: ready.brief,
      plan: ready.plan,
      conceptSet: ready.concepts,
      interpreter: ready.interpreter,
    });
  }

  conversation.push(
    message(
      "customer",
      input.skip ? (input.language === "ar" ? "تخطي" : "Skip") : userText,
      field.key,
      input.skip,
    ),
  );

  let nextFacts = facts;
  if (input.skip || isSkip(userText)) {
    if (field.required) {
      conversation.push(
        message(
          "agent",
          input.language === "ar" ? "نحتاج هذه المعلومة للمتابعة." : "We need this to continue.",
          field.key,
        ),
      );
      return persist({
        id: input.campaign.id,
        customerId: input.campaign.customerId,
        status: "drafting",
        originalPrompt: input.campaign.originalPrompt,
        facts,
        conversation,
        brief: {},
        plan: {},
        interpreter: input.campaign.interpreter,
      });
    }
  } else {
    nextFacts = applyFieldAnswer(facts, field, userText);
  }

  const remaining = nextMissing(fields, nextFacts as unknown as Record<string, unknown>);
  if (remaining) {
    conversation.push(ask(remaining, input.language));
    return persist({
      id: input.campaign.id,
      customerId: input.campaign.customerId,
      status: "drafting",
      originalPrompt: input.campaign.originalPrompt,
      facts: nextFacts,
      conversation,
      brief: {},
      plan: {},
      interpreter: input.campaign.interpreter,
    });
  }

  const ready = await readyPlan({
    customerId: input.campaign.customerId,
    business: input.business,
    facts: nextFacts,
    prompt: input.campaign.originalPrompt,
    history,
    reused: input.campaign.marketingPlan?.reusedFromHistory ?? [],
    historyNote: input.campaign.marketingPlan?.historyNote,
    language: input.language,
    conversation,
  });
  return persist({
    id: input.campaign.id,
    customerId: input.campaign.customerId,
    status: "brief_ready",
    originalPrompt: input.campaign.originalPrompt,
    facts: nextFacts,
    conversation: ready.conversation,
    brief: ready.brief,
    plan: ready.plan,
    conceptSet: ready.concepts,
    interpreter: ready.interpreter,
  });
}

export async function chooseConcept(input: {
  campaign: Campaign;
  conceptId?: string;
  useRecommended?: boolean;
  language: Language;
}): Promise<Campaign | { error: string; status: number }> {
  if (input.campaign.status !== "brief_ready") {
    return { error: "Concepts can be chosen while the brief is ready", status: 409 };
  }
  const set = input.campaign.conceptSet;
  if (!set || set.concepts.length < 3) {
    return { error: "Concepts are not ready yet", status: 409 };
  }
  const chosenBy: "customer" | "ai" = input.useRecommended ? "ai" : "customer";
  const selectedId = (
    input.useRecommended ? set.recommendedId : input.conceptId
  ) as ConceptLane | "";
  const picked = set.concepts.find((item) => item.id === selectedId);
  if (!picked) return { error: "Unknown concept", status: 400 };
  const next: ConceptSet = { ...set, selectedId: picked.id, chosenBy };
  const conversation = [
    ...input.campaign.conversation,
    message(
      "customer",
      chosenBy === "ai"
        ? input.language === "ar"
          ? "استخدم الاتجاه الذي توصي به"
          : "Use the recommended concept"
        : input.language === "ar"
          ? `أختار: ${picked.title}`
          : `Use ${picked.title}`,
    ),
    message(
      "agent",
      input.language === "ar"
        ? `تم حفظ «${picked.title}». راجع الملخص ثم أكّد. لن نولّد وسائط الآن.`
        : `Saved “${picked.title}”. Review the brief, then confirm. No media will be generated yet.`,
    ),
  ];
  return persist({
    id: input.campaign.id,
    customerId: input.campaign.customerId,
    status: "brief_ready",
    originalPrompt: input.campaign.originalPrompt,
    facts: {
      productName: input.campaign.productName,
      offer: input.campaign.offer,
      objective: input.campaign.objective,
      formatPreference: input.campaign.formatPreference,
      existingPhotosNote: input.campaign.existingPhotosNote,
      mustAppear: input.campaign.mustAppear,
      audienceNote: input.campaign.audienceNote,
    },
    conversation,
    brief: input.campaign.interpretedBrief,
    plan: input.campaign.marketingPlan ?? {},
    conceptSet: next,
    interpreter: input.campaign.interpreter,
  });
}

export async function confirmCampaign(customerId: string, campaign: Campaign, business: Business) {
  const facts = {
    productName: campaign.productName,
    offer: campaign.offer,
    objective: campaign.objective,
    formatPreference: campaign.formatPreference,
    existingPhotosNote: campaign.existingPhotosNote,
    mustAppear: campaign.mustAppear,
    audienceNote: campaign.audienceNote,
  };
  if (!campaign.conceptSet?.selectedId) {
    return { error: "Pick a concept before confirming", status: 409 as const };
  }
  const history = await listCampaignHistory(customerId, business.id, campaign.id);
  const ready = campaign.marketingPlan?.framework
    ? {
        brief: buildBrief(business, facts, campaign.originalPrompt, campaign.interpreter),
        plan: campaign.marketingPlan,
        interpreter: campaign.interpreter,
        concepts: campaign.conceptSet,
      }
    : await readyPlan({
        customerId,
        business,
        facts,
        prompt: campaign.originalPrompt,
        history,
        reused: campaign.marketingPlan?.reusedFromHistory ?? [],
        language: "en",
        conversation: campaign.conversation,
      }).then((row) => ({
        brief: row.brief,
        plan: row.plan,
        interpreter: row.interpreter,
        concepts: campaign.conceptSet ?? row.concepts,
      }));
  const picked = campaign.conceptSet.concepts.find((item) => item.id === campaign.conceptSet?.selectedId);
  const conversation = [
    ...campaign.conversation,
    message("customer", "Confirm brief"),
    message(
      "agent",
      `The brief, marketing plan, and “${picked?.title ?? "selected"}” concept are stored. Review the fal.ai estimate, then authorize if you want a paid still or video. If FAL_KEY is not on the server, a local preview still is available and the brief is not sent out.`,
    ),
  ];
  const saved = await persist({
    id: campaign.id,
    customerId,
    status: "confirmed",
    originalPrompt: campaign.originalPrompt,
    facts,
    conversation,
    brief: ready.brief,
    plan: ready.plan,
    conceptSet: ready.concepts,
    interpreter: ready.interpreter,
  });
  await rememberConfirmedBrief({
    customerId,
    businessId: business.id,
    campaignId: campaign.id,
    businessName: business.name,
    productName: facts.productName,
    offer: facts.offer,
    objective: facts.objective,
    formatPreference: facts.formatPreference,
    prompt: campaign.originalPrompt,
    hypotheses: ready.plan.hypotheses ?? [],
    conceptTitle: picked?.title,
    conceptChosenBy: campaign.conceptSet.chosenBy,
  });
  return saved;
}

export { emptyFacts };
