const FIELD_LABELS: Array<{ key: string; label: RegExp; en: string; ar: string }> = [
  { key: "productsServices", label: /^(?:products?(?:\s+and\s+services)?|services?|المنتجات|الخدمات)$/i, en: "products and services", ar: "المنتجات والخدمات" },
  { key: "targetCustomers", label: /^(?:target\s+customers?|customers?|audience|العملاء|الجمهور)$/i, en: "customers", ar: "العملاء" },
  { key: "brandPersonality", label: /^(?:brand\s+personality|personality|tone|الشخصية|النبرة)$/i, en: "brand personality", ar: "شخصية العلامة" },
  { key: "marketingGoals", label: /^(?:marketing\s+goals?|goals?|الأهداف|الهدف)$/i, en: "marketing goals", ar: "الأهداف التسويقية" },
  { key: "publicContact", label: /^(?:public\s+contact|contact|phone|whatsapp|email|التواصل|الهاتف)$/i, en: "contact", ar: "التواصل" },
  { key: "description", label: /^(?:description|about(?:\s+us)?|الوصف|نبذة)$/i, en: "description", ar: "الوصف" },
  { key: "category", label: /^(?:category|type(?:\s+of\s+business)?|what\s+we\s+do|الفئة|المجال)$/i, en: "category", ar: "الفئة" },
  { key: "website", label: /^(?:website|web\s*site|site|url|link|الموقع\s+الإلكتروني|الموقع\s+الالكتروني)$/i, en: "website", ar: "الموقع الإلكتروني" },
  { key: "location", label: /^(?:location|city|address|الموقع|العنوان|المدينة)$/i, en: "location", ar: "الموقع" },
  { key: "name", label: /^(?:business\s+name|name|اسم(?:\s+العمل)?)$/i, en: "name", ar: "الاسم" },
];

export function parseBusinessEdit(text: string): { key: string; value: string } | null {
  const value = text.trim().replace(/[.!?]+$/g, "");
  if (!value) return null;
  const based =
    value.match(/^(?:we(?:\s+are|'re)|i(?:\s+am|'m))\s+(?:based\s+)?in\s+(.+)$/i) ||
    value.match(/^(?:موجود(?:ين|ون)?|نتواجد)\s+في\s+(.+)$/);
  if (based?.[1]?.trim()) return { key: "location", value: based[1].trim() };
  if (/^https?:\/\//i.test(value)) return { key: "website", value };

  const match = value.match(
    /^(?:please\s+)?(?:change|update|set|edit|make|rename|غيّ?ر|حدّ?ث|خلّ?ي)?\s*(?:the\s+|our\s+|ال\s*)?(.+?)\s+(?:to|into|is|are|as|:|إلى|الى|هو|هي)\s+(.+)$/i,
  );
  if (!match) return null;
  const label = match[1].trim();
  const nextValue = match[2].trim();
  if (!nextValue) return null;
  const field = FIELD_LABELS.find((item) => item.label.test(label));
  return field ? { key: field.key, value: nextValue } : null;
}

export function businessEditReply(input: {
  key: string | null;
  value: string;
  language: "en" | "ar";
}): string {
  if (!input.key) {
    return input.language === "ar"
      ? "قل لي ماذا أغيّر. مثال: الموقع إلى دبي مارينا، أو المنتجات إلى هوديز وقبعات."
      : "Tell me what to change. For example: location to Dubai Marina, or products to hoodies and caps.";
  }
  const field = FIELD_LABELS.find((item) => item.key === input.key);
  const label = field ? field[input.language] : input.key;
  return input.language === "ar"
    ? `تم تحديث ${label} إلى ${input.value}. قل لي إن كان هناك شيء آخر.`
    : `Updated the ${label} to ${input.value}. Tell me if something else should change.`;
}
