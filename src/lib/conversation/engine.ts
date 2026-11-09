import { detectCategory, isNewProductIntent } from "../agent/context";
import type {
  Business,
  CampaignFacts,
  ChatMessage,
  InterpretedBrief,
  Language,
} from "../types";
import { newId } from "../crypto";
import { emptyFacts, extractFromUtterance, isSkip, mergeFacts } from "./extract";
import { getLlmProvider, interpreterLabel, type LlmProvider } from "./llm";

export type FieldSpec = {
  key: keyof CampaignFacts | "name" | string;
  required: boolean;
  prompt: { en: string; ar: string };
};

export const CAMPAIGN_FIELDS: FieldSpec[] = [
  {
    key: "productName",
    required: true,
    prompt: {
      en: "What are we promoting in this ad?",
      ar: "ما الذي نروّج له في هذا الإعلان؟",
    },
  },
  {
    key: "objective",
    required: true,
    prompt: {
      en: "What should this ad achieve? For example: increase orders, attract new customers, or build awareness.",
      ar: "ماذا يجب أن يحقق هذا الإعلان؟ مثلاً: زيادة الطلبات، جذب عملاء جدد، أو بناء الوعي.",
    },
  },
  {
    key: "offer",
    required: false,
    prompt: {
      en: "Is there a special offer or price that must appear? Skip if none.",
      ar: "هل هناك عرض أو سعر يجب أن يظهر؟ يمكنك التخطي إن لم يوجد.",
    },
  },
  {
    key: "formatPreference",
    required: false,
    prompt: {
      en: "Do you want an image, a video, both, or should we recommend later?",
      ar: "هل تريد صورة، فيديو، الاثنين، أم نقرر لاحقاً؟",
    },
  },
  {
    key: "existingPhotosNote",
    required: false,
    prompt: {
      en: "Should we use existing product photos you already uploaded, or is there anything to know about photography?",
      ar: "هل نستخدم صور المنتجات المرفوعة، أو لديك ملاحظة عن التصوير؟",
    },
  },
  {
    key: "mustAppear",
    required: false,
    prompt: {
      en: "Anything that must appear in the ad — logo, price, ingredients, location?",
      ar: "أي شيء يجب أن يظهر في الإعلان — الشعار، السعر، المكوّنات، الموقع؟",
    },
  },
];

export function campaignFields(prompt: string): FieldSpec[] {
  if (detectCategory(prompt) !== "fragrance") return CAMPAIGN_FIELDS;
  return [
    {
      key: "productName",
      required: true,
      prompt: {
        en: "What is the perfume called? If it has no name yet, say so — I will not invent one.",
        ar: "ما اسم العطر؟ إن لم يكن له اسم بعد، قُل ذلك — لن أخترع اسماً.",
      },
    },
    {
      key: "audienceNote",
      required: false,
      prompt: {
        en: "Who is it for? Skip if you have not decided.",
        ar: "لمن هو؟ يمكنك التخطي إن لم تقرر بعد.",
      },
    },
    {
      key: "objective",
      required: true,
      prompt: {
        en: "What should this ad achieve? For example: awareness, launch, or more inquiries. I will not invent a goal.",
        ar: "ماذا يجب أن يحقق هذا الإعلان؟ مثلاً الوعي أو الإطلاق أو المزيد من الاستفسارات. لن أخترع هدفاً.",
      },
    },
    {
      key: "offer",
      required: false,
      prompt: {
        en: "Any verified price or size that must appear? Skip if none. I will not invent a price or scent notes.",
        ar: "هل هناك سعر أو حجم موثّق يجب أن يظهر؟ تخطَّ إن لم يوجد. لن أخترع سعراً أو روائح.",
      },
    },
    {
      key: "mustAppear",
      required: false,
      prompt: {
        en: "Any other facts we must use (bottle color, exact spelling)? Skip if none — I will not invent claims.",
        ar: "أي حقائق أخرى يجب استخدامها (لون الزجاجة، الكتابة الدقيقة)؟ تخطَّ إن لم توجد — لن أخترع ادعاءات.",
      },
    },
    {
      key: "formatPreference",
      required: false,
      prompt: {
        en: "Do you want an image, a video, both, or should we recommend later?",
        ar: "هل تريد صورة، فيديو، الاثنين، أم نقرر لاحقاً؟",
      },
    },
  ];
}

export const BUSINESS_FIELDS: FieldSpec[] = [
  {
    key: "name",
    required: true,
    prompt: {
      en: "What is the business name?",
      ar: "ما اسم العمل؟",
    },
  },
  {
    key: "category",
    required: false,
    prompt: {
      en: "What do you do there? Say it in your own words, or skip.",
      ar: "ماذا تفعلون هناك؟ صِفْه بكلامك، أو تخطَّ.",
    },
  },
  {
    key: "productsServices",
    required: false,
    prompt: {
      en: "What products or services should we remember?",
      ar: "ما المنتجات أو الخدمات التي ينبغي أن نتذكرها؟",
    },
  },
  {
    key: "description",
    required: false,
    prompt: {
      en: "In a few sentences, how would you describe the business?",
      ar: "بجمل قصيرة، كيف تصف العمل؟",
    },
  },
  {
    key: "targetCustomers",
    required: false,
    prompt: {
      en: "Who are the customers?",
      ar: "من هم العملاء؟",
    },
  },
  {
    key: "location",
    required: false,
    prompt: {
      en: "Where is it based?",
      ar: "أين يقع؟",
    },
  },
  {
    key: "website",
    required: false,
    prompt: {
      en: "Website, if you have one?",
      ar: "الموقع الإلكتروني إن وُجد؟",
    },
  },
  {
    key: "publicContact",
    required: false,
    prompt: {
      en: "A public phone, WhatsApp, or Instagram we may show?",
      ar: "هاتف أو واتساب أو إنستغرام عام يمكن إظهاره؟",
    },
  },
  {
    key: "brandPersonality",
    required: false,
    prompt: {
      en: "How should the brand feel? Bold, warm, premium, playful…",
      ar: "كيف يجب أن تشعر العلامة؟ جريئة، دافئة، راقية، مرحة…",
    },
  },
  {
    key: "marketingGoals",
    required: false,
    prompt: {
      en: "What are the usual marketing goals?",
      ar: "ما الأهداف التسويقية المعتادة؟",
    },
  },
  {
    key: "brandColors",
    required: false,
    prompt: {
      en: "Any brand colors? Names or hex codes are fine. Skip if none.",
      ar: "ألوان العلامة؟ الأسماء أو الرموز مقبولة. يمكنك التخطي.",
    },
  },
  {
    key: "preferredLanguage",
    required: false,
    prompt: {
      en: "Preferred language for ads: English, Arabic, or both?",
      ar: "اللغة المفضلة للإعلانات: الإنجليزية، العربية، أو الاثنتان؟",
    },
  },
];

export function message(
  role: ChatMessage["role"],
  text: string,
  field?: string,
  skipped = false,
): ChatMessage {
  return {
    id: newId(),
    role,
    text,
    at: new Date().toISOString(),
    field,
    skipped,
  };
}

export function nextMissing(
  fields: FieldSpec[],
  values: Record<string, unknown>,
): FieldSpec | null {
  for (const field of fields) {
    const value = values[field.key];
    const filled =
      value !== null &&
      value !== undefined &&
      value !== "" &&
      !(typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);
    if (!filled) return field;
  }
  return null;
}

export function ask(field: FieldSpec, language: Language): ChatMessage {
  return message("agent", field.prompt[language], field.key);
}

export async function interpretCampaignPrompt(input: {
  prompt: string;
  business: Business;
  language: Language;
  provider?: LlmProvider;
}): Promise<{ facts: CampaignFacts; interpreter: string }> {
  const provider = input.provider ?? getLlmProvider();
  const structured = extractFromUtterance(input.prompt, input.business);
  let llmFacts: Partial<CampaignFacts> | null = null;
  if (provider.isConfigured()) {
    try {
      llmFacts = await provider.interpret({
        prompt: input.prompt,
        business: input.business,
        language: input.language,
      });
    } catch {
      llmFacts = null;
    }
  }
  const facts = completeFactsFromProfile(
    mergeFacts(emptyFacts(), { ...llmFacts, ...structured }),
    input.business,
    input.prompt,
  );
  return { facts, interpreter: interpreterLabel(provider) };
}

export function applyFieldAnswer(
  facts: CampaignFacts,
  field: FieldSpec,
  text: string,
): CampaignFacts {
  if (isSkip(text) && !field.required) {
    return facts;
  }
  const extracted = extractFromUtterance(text, null);
  const next = { ...facts };
  const key = field.key as keyof CampaignFacts;
  if (key === "formatPreference") {
    next.formatPreference = extracted.formatPreference ?? (isSkip(text) ? "ai_recommend" : null);
    if (!next.formatPreference && text.trim()) {
      const lower = text.toLowerCase();
      if (lower.includes("image") || lower.includes("صورة")) next.formatPreference = "image";
      else if (lower.includes("video") || lower.includes("فيديو")) next.formatPreference = "video";
      else if (lower.includes("both") || lower.includes("الاثنين")) next.formatPreference = "both";
      else next.formatPreference = "ai_recommend";
    }
    return next;
  }
  if (key === "productName") next.productName = extracted.productName || text.trim();
  else if (key === "offer") next.offer = extracted.offer || text.trim();
  else if (key === "objective") next.objective = extracted.objective || text.trim();
  else if (key === "existingPhotosNote") next.existingPhotosNote = text.trim();
  else if (key === "mustAppear") next.mustAppear = extracted.mustAppear || text.trim();
  else if (key === "audienceNote") next.audienceNote = text.trim();
  return mergeFacts(next, extracted);
}

export function buildBrief(
  business: Business,
  facts: CampaignFacts,
  prompt: string,
  interpreter: string,
): InterpretedBrief {
  const missing: string[] = [];
  if (!facts.productName) missing.push("productName");
  if (!facts.objective) missing.push("objective");
  return {
    businessName: business.name,
    sourcePrompt: prompt,
    productName: facts.productName,
    offer: facts.offer,
    objective: facts.objective,
    formatPreference: facts.formatPreference,
    existingPhotosNote: facts.existingPhotosNote,
    mustAppear: facts.mustAppear,
    audienceNote: facts.audienceNote,
    missing,
    interpreter,
    generation: "not_started",
  };
}

export function greeting(
  language: Language,
  businessName: string,
  historyLine = "",
  prompt = "",
): ChatMessage {
  const fresh = isNewProductIntent(prompt) || detectCategory(prompt) === "fragrance";
  if (fresh) {
    const text =
      language === "ar"
        ? `سأستخدم ملف ${businessName} للعلامة فقط. هذا منتج جديد، لذلك لن أنسخ المنتج أو العرض أو الهدف أو المفهوم السابق. ${historyLine}`
        : `I’ll use the ${businessName} profile for the brand only. This looks like a new product, so I will not copy the previous product, offer, objective, or concept. ${historyLine}`;
    return message("agent", text);
  }
  const text =
    language === "ar"
      ? `سأستخدم ملف ${businessName}.${historyLine} اكتب ما تريد الإعلان عنه، وسأسأل فقط عما ينقص.`
      : `I’ll use the ${businessName} profile.${historyLine} Tell me what you want to advertise — I’ll only ask for what’s missing.`;
  return message("agent", text);
}

export function summaryPrompt(language: Language): ChatMessage {
  const text =
    language === "ar"
      ? "هذا ملخص الحملة كما فهمته. راجعه، اختر اتجاهاً، ثم أكّد. بعدها سترى تقدير fal.ai قبل أي توليد مدفوع."
      : "Here is the campaign brief as I understood it. Review it, pick a direction, then confirm. After that you will see the fal.ai estimate before any paid generation.";
  return message("agent", text, "summary");
}

export function briefingFields(prompt: string): FieldSpec[] {
  return campaignFields(prompt).filter((field) => field.required);
}

export function completeFactsFromProfile(facts: CampaignFacts, business: Business, prompt: string): CampaignFacts {
  const next = { ...facts };
  if (!next.productName?.trim()) {
    const service = business.productsServices
      .split(/[,;\n]/)
      .map((part) => part.trim())
      .find((part) => part.length >= 3);
    next.productName = service || prompt.trim().slice(0, 120) || business.name;
  }
  if (!next.objective?.trim()) {
    next.objective = business.marketingGoals.trim() || `Promote ${next.productName}`;
  }
  if (!next.audienceNote?.trim() && business.targetCustomers.trim()) {
    next.audienceNote = business.targetCustomers.trim();
  }
  if (!next.formatPreference) next.formatPreference = "ai_recommend";
  return next;
}

export function awaitingFromFacts(facts: CampaignFacts, prompt = ""): string | null {
  const next = nextMissing(briefingFields(prompt), facts as unknown as Record<string, unknown>);
  return next?.key ?? "summary";
}

export { isSkip };
