import "server-only";

import { newId } from "../crypto";
import { parseJson, sql } from "../db";
import type {
  BrandColors,
  Business,
  BusinessAsset,
  BusinessOnboardingState,
  ChatMessage,
  Language,
} from "../types";
import { isAffirmation, senseBusiness, senseLine, type BusinessSense } from "../conversation/business-sense";
import {
  BUSINESS_FIELDS,
  isSkip,
  message,
  nextMissing,
} from "../conversation/engine";

type BusinessRow = {
  id: string;
  customer_id: string;
  name: string;
  category: string;
  description: string;
  products_services: string;
  target_customers: string;
  location: string;
  website: string;
  public_contact: string;
  brand_personality: string;
  marketing_goals: string;
  brand_colors: unknown;
  preferred_language: Language;
  is_active: boolean;
  onboarding_complete: boolean;
  onboarding_state: unknown;
  created_at: string;
  updated_at: string;
};

function mapBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    customerId: row.customer_id,
    name: row.name,
    category: row.category,
    description: row.description,
    productsServices: row.products_services,
    targetCustomers: row.target_customers,
    location: row.location,
    website: row.website,
    publicContact: row.public_contact,
    brandPersonality: row.brand_personality,
    marketingGoals: row.marketing_goals,
    brandColors: parseJson<BrandColors>(row.brand_colors, {}),
    preferredLanguage: row.preferred_language,
    isActive: row.is_active,
    onboardingComplete: row.onboarding_complete,
    onboardingState: parseJson<BusinessOnboardingState>(row.onboarding_state, {
      messages: [],
      awaiting: "name",
    }),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listBusinesses(customerId: string): Promise<Business[]> {
  const rows = await sql<BusinessRow>(
    `select * from businesses where customer_id = $1 order by is_active desc, updated_at desc`,
    [customerId],
  );
  const businesses = rows.map(mapBusiness);
  const counts = await sql<{ business_id: string; kind: string; n: string }>(
    `select business_id, kind, count(*)::text as n
     from business_assets where customer_id = $1
     group by business_id, kind`,
    [customerId],
  );
  const map = new Map<string, { logo: number; productPhoto: number }>();
  for (const row of counts) {
    const current = map.get(row.business_id) ?? { logo: 0, productPhoto: 0 };
    if (row.kind === "logo") current.logo = Number(row.n);
    if (row.kind === "product_photo") current.productPhoto = Number(row.n);
    map.set(row.business_id, current);
  }
  return businesses.map((business) => ({
    ...business,
    assetCounts: map.get(business.id) ?? { logo: 0, productPhoto: 0 },
  }));
}

async function withAssetCounts(business: Business): Promise<Business> {
  const counts = await sql<{ kind: string; n: string }>(
    `select kind, count(*)::text as n from business_assets where business_id = $1 group by kind`,
    [business.id],
  );
  const assetCounts = { logo: 0, productPhoto: 0 };
  for (const row of counts) {
    if (row.kind === "logo") assetCounts.logo = Number(row.n);
    if (row.kind === "product_photo") assetCounts.productPhoto = Number(row.n);
  }
  return { ...business, assetCounts };
}

export async function getBusiness(customerId: string, id: string) {
  const rows = await sql<BusinessRow>(
    `select * from businesses where id = $1 and customer_id = $2 limit 1`,
    [id, customerId],
  );
  return rows[0] ? withAssetCounts(mapBusiness(rows[0])) : null;
}

export async function getActiveBusiness(customerId: string) {
  const rows = await sql<BusinessRow>(
    `select * from businesses where customer_id = $1 and is_active = true limit 1`,
    [customerId],
  );
  if (rows[0]) return withAssetCounts(mapBusiness(rows[0]));
  const any = await sql<BusinessRow>(
    `select * from businesses where customer_id = $1 order by updated_at desc limit 1`,
    [customerId],
  );
  return any[0] ? withAssetCounts(mapBusiness(any[0])) : null;
}

export async function startBusiness(
  customerId: string,
  language: Language,
): Promise<Business> {
  const existing = await sql<{ n: string }>(
    `select count(*)::text as n from businesses where customer_id = $1`,
    [customerId],
  );
  const first = Number(existing[0]?.n ?? 0) === 0;
  const id = newId();
  const intro =
    language === "ar"
      ? "لنحفظ ملف العمل. ما اسم العمل؟ يمكنك تخطي الأسئلة الاختيارية لاحقاً."
      : "Let’s save the business profile. What is the business name? You can skip optional questions later.";
  const state: BusinessOnboardingState = {
    messages: [message("agent", intro, "name")],
    awaiting: "name",
  };
  const rows = await sql<BusinessRow>(
    `insert into businesses (
       id, customer_id, is_active, preferred_language, onboarding_state
     ) values ($1, $2, $3, $4, $5::jsonb)
     returning *`,
    [id, customerId, first, language, JSON.stringify(state)],
  );
  if (first) {
    await sql(
      `update businesses set is_active = false where customer_id = $1 and id <> $2`,
      [customerId, id],
    );
  }
  return mapBusiness(rows[0]);
}

function valuesFromBusiness(business: Business): Record<string, unknown> {
  return {
    name: business.name,
    category: business.category,
    productsServices: business.productsServices,
    description: business.description,
    targetCustomers: business.targetCustomers,
    location: business.location,
    website: business.website,
    publicContact: business.publicContact,
    brandPersonality: business.brandPersonality,
    marketingGoals: business.marketingGoals,
    brandColors:
      Object.keys(business.brandColors).length > 0 ? business.brandColors : "",
    preferredLanguage: business.preferredLanguage,
  };
}

function applyBusinessAnswer(business: Business, fieldKey: string, text: string): Business {
  const next = { ...business };
  switch (fieldKey) {
    case "name":
      next.name = text.trim();
      break;
    case "category":
      next.category = text.trim();
      break;
    case "productsServices":
      next.productsServices = text.trim();
      break;
    case "description":
      next.description = text.trim();
      break;
    case "targetCustomers":
      next.targetCustomers = text.trim();
      break;
    case "location":
      next.location = text.trim();
      break;
    case "website":
      next.website = text.trim();
      break;
    case "publicContact":
      next.publicContact = text.trim();
      break;
    case "brandPersonality":
      next.brandPersonality = text.trim();
      break;
    case "marketingGoals":
      next.marketingGoals = text.trim();
      break;
    case "brandColors": {
      const hexes = text.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g) ?? [];
      next.brandColors = {
        primary: hexes[0],
        secondary: hexes[1],
        accent: hexes[2] ?? text.trim(),
      };
      if (!hexes.length) next.brandColors = { primary: text.trim() };
      break;
    }
    case "preferredLanguage": {
      const lower = text.toLowerCase();
      if (lower.includes("ar") || lower.includes("عر")) next.preferredLanguage = "ar";
      else next.preferredLanguage = "en";
      break;
    }
    default:
      break;
  }
  return next;
}

function senseForTurn(name: string, fieldKey: string, answer: string, skipped: boolean): BusinessSense | null {
  if (fieldKey === "name" || skipped || (fieldKey === "category" && isAffirmation(answer))) {
    return senseBusiness(name);
  }
  if (fieldKey === "category") return senseBusiness(answer);
  return senseBusiness(`${name} ${answer}`) ?? senseBusiness(name);
}

function applySense(
  business: Business,
  sense: BusinessSense | null,
  language: Language,
): { business: Business; sense: BusinessSense | null } {
  if (!sense) return { business, sense: null };
  const next = { ...business };
  const lang = language === "ar" ? "ar" : "en";
  let applied = false;
  if (!next.category.trim()) {
    next.category = sense.category[lang];
    applied = true;
  }
  if (!next.productsServices.trim()) {
    next.productsServices = sense.services[lang];
    applied = true;
  }
  if (!next.description.trim()) {
    next.description = sense.description[lang];
    applied = true;
  }
  if (!next.targetCustomers.trim()) {
    next.targetCustomers = sense.customers[lang];
    applied = true;
  }
  return { business: next, sense: applied ? sense : null };
}

function questionFor(
  business: Business,
  field: (typeof BUSINESS_FIELDS)[number],
  language: Language,
  sense: BusinessSense | null,
): string {
  const prompt = field.prompt[language];
  if (!sense || !business.name.trim()) return prompt;
  return `${senseLine(business.name.trim(), sense, language)} ${prompt}`;
}

async function persistBusiness(business: Business, complete: boolean) {
  const rows = await sql<BusinessRow>(
    `update businesses set
       name = $3,
       category = $4,
       description = $5,
       products_services = $6,
       target_customers = $7,
       location = $8,
       website = $9,
       public_contact = $10,
       brand_personality = $11,
       marketing_goals = $12,
       brand_colors = $13::jsonb,
       preferred_language = $14,
       onboarding_complete = $15,
       onboarding_state = $16::jsonb,
       updated_at = now()
     where id = $1 and customer_id = $2
     returning *`,
    [
      business.id,
      business.customerId,
      business.name ?? "",
      business.category ?? "",
      business.description ?? "",
      business.productsServices ?? "",
      business.targetCustomers ?? "",
      business.location ?? "",
      business.website ?? "",
      business.publicContact ?? "",
      business.brandPersonality ?? "",
      business.marketingGoals ?? "",
      JSON.stringify(business.brandColors ?? {}),
      business.preferredLanguage ?? "en",
      complete,
      JSON.stringify(business.onboardingState),
    ],
  );
  return mapBusiness(rows[0]);
}

export async function continueBusinessOnboarding(input: {
  business: Business;
  text: string;
  skip: boolean;
  skipRemaining: boolean;
  language: Language;
}): Promise<Business> {
  const awaiting = input.business.onboardingState.awaiting;
  const field = BUSINESS_FIELDS.find((item) => item.key === awaiting);
  let next = { ...input.business };
  const messages: ChatMessage[] = [...next.onboardingState.messages];

  if (input.skipRemaining) {
    if (!next.name.trim()) {
      messages.push(
        message(
          "agent",
          input.language === "ar"
            ? "نحتاج اسم العمل على الأقل."
            : "We still need the business name.",
          "name",
        ),
      );
      next.onboardingState = { messages, awaiting: "name" };
      return persistBusiness(next, false);
    }
    messages.push(
      message(
        "agent",
        input.language === "ar"
          ? "تم. يمكنك تعديل التفاصيل ورفع الشعار والصور في أي وقت."
          : "Saved. You can edit details and upload a logo or photos anytime.",
      ),
    );
    next.onboardingState = { messages, awaiting: null };
    next.onboardingComplete = true;
    return persistBusiness(next, true);
  }

  if (!field) {
    next.onboardingComplete = true;
    next.onboardingState = { messages, awaiting: null };
    return persistBusiness(next, true);
  }

  const userText = input.text.trim();
  if (!input.skip && !userText) return next;
  messages.push(message("customer", input.skip ? (input.language === "ar" ? "تخطي" : "Skip") : userText, field.key, input.skip));

  if (field.required && (input.skip || isSkip(userText))) {
    messages.push(
      message(
        "agent",
        input.language === "ar" ? "هذا الحقل مطلوب." : "This one is required.",
        field.key,
      ),
    );
    next.onboardingState = { messages, awaiting: field.key };
    return persistBusiness(next, false);
  }

  if (!input.skip && !isSkip(userText)) {
    next = applyBusinessAnswer(next, field.key, userText);
  }

  if (field.key === "category" && isAffirmation(userText)) {
    next.category = "";
  }

  const sensed = senseForTurn(next.name, field.key, userText, input.skip || isSkip(userText));
  const understood = applySense(next, sensed, input.language);
  next = understood.business;

  const values = valuesFromBusiness(next);
  if (field.key === "name" && next.name) values.name = next.name;
  const remaining = BUSINESS_FIELDS.filter((item) => item.key !== field.key);
  const upcoming = nextMissing(remaining, values) ?? nextMissing(BUSINESS_FIELDS, values);

  if (!upcoming || (upcoming.key === field.key && (input.skip || next.name))) {
    const after = BUSINESS_FIELDS.find((item) => {
      const value = values[item.key];
      return !value;
    });
    if (!after || (after.key === field.key && next.name)) {
      messages.push(
        message(
          "agent",
          input.language === "ar"
            ? "ملف العمل جاهز. ارفع شعاراً أو صور منتجات إن أحببت."
            : "The profile is ready. Upload a logo or product photos if you like.",
        ),
      );
      next.onboardingState = { messages, awaiting: null };
      next.onboardingComplete = true;
      return persistBusiness(next, true);
    }
  }

  const nextField = BUSINESS_FIELDS.find((item) => {
    if (item.key === field.key) return false;
    const value = valuesFromBusiness(next)[item.key];
    return !value;
  });

  if (!nextField) {
    messages.push(
      message(
        "agent",
        input.language === "ar"
          ? "ملف العمل جاهز. ارفع شعاراً أو صور منتجات إن أحببت."
          : "The profile is ready. Upload a logo or product photos if you like.",
      ),
    );
    next.onboardingState = { messages, awaiting: null };
    next.onboardingComplete = true;
    return persistBusiness(next, true);
  }

  messages.push(message("agent", questionFor(next, nextField, input.language, understood.sense), nextField.key));
  next.onboardingState = { messages, awaiting: nextField.key };
  next.onboardingComplete = false;
  return persistBusiness(next, false);
}

export async function updateBusiness(
  customerId: string,
  id: string,
  patch: Partial<Business>,
) {
  const current = await getBusiness(customerId, id);
  if (!current) return null;
  const cleaned = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<Business>;
  const merged: Business = {
    ...current,
    ...cleaned,
    id: current.id,
    customerId: current.customerId,
    brandColors: cleaned.brandColors ?? current.brandColors,
  };
  return persistBusiness(merged, merged.onboardingComplete || Boolean(merged.name.trim()));
}

export async function setActiveBusiness(customerId: string, id: string) {
  const current = await getBusiness(customerId, id);
  if (!current) return null;
  await sql(`update businesses set is_active = false where customer_id = $1`, [customerId]);
  await sql(
    `update businesses set is_active = true, updated_at = now() where id = $1 and customer_id = $2`,
    [id, customerId],
  );
  return getBusiness(customerId, id);
}

export async function listAssets(customerId: string, businessId: string) {
  const rows = await sql<BusinessAsset & { original_name: string; mime_type: string; byte_size: number; created_at: string; business_id: string }>(
    `select id, business_id, kind, original_name, mime_type, byte_size, created_at
     from business_assets
     where customer_id = $1 and business_id = $2
     order by created_at desc`,
    [customerId, businessId],
  );
  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    kind: row.kind as BusinessAsset["kind"],
    originalName: row.original_name,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function insertAsset(input: {
  customerId: string;
  businessId: string;
  kind: "logo" | "product_photo";
  originalName: string;
  mimeType: string;
  byteSize: number;
  storageKey: string;
}) {
  const id = newId();
  await sql(
    `insert into business_assets (
       id, customer_id, business_id, kind, original_name, mime_type, byte_size, storage_key
     ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id,
      input.customerId,
      input.businessId,
      input.kind,
      input.originalName.slice(0, 180),
      input.mimeType,
      input.byteSize,
      input.storageKey,
    ],
  );
  return id;
}

export async function getOwnedAsset(customerId: string, assetId: string, asAdmin: boolean) {
  if (asAdmin) {
    const rows = await sql<{
      id: string;
      storage_key: string;
      mime_type: string;
      original_name: string;
    }>(
      `select id, storage_key, mime_type, original_name from business_assets where id = $1 limit 1`,
      [assetId],
    );
    return rows[0] ?? null;
  }
  const rows = await sql<{
    id: string;
    storage_key: string;
    mime_type: string;
    original_name: string;
  }>(
    `select id, storage_key, mime_type, original_name
     from business_assets where id = $1 and customer_id = $2 limit 1`,
    [assetId, customerId],
  );
  return rows[0] ?? null;
}

export async function deleteAsset(customerId: string, assetId: string) {
  const rows = await sql<{ id: string }>(
    `delete from business_assets where id = $1 and customer_id = $2 returning id`,
    [assetId, customerId],
  );
  return rows[0] ?? null;
}
