export type BusinessSense = {
  category: { en: string; ar: string };
  services: { en: string; ar: string };
  description: { en: string; ar: string };
  customers: { en: string; ar: string };
};

const TRADES: Array<BusinessSense & { test: RegExp }> = [
  {
    test: /\b(salons?|saloons?|barbers?|barbershops?|hairdress\w*|hairstyl\w*|hair\s*cuts?)\b|صالون|حلاق|كوافير/i,
    category: { en: "Hair salon", ar: "صالون شعر" },
    services: { en: "Haircuts, styling, and grooming", ar: "قص الشعر والتسريح والعناية" },
    description: { en: "A hair salon for cuts, styling, and grooming", ar: "صالون لقص الشعر وتسريحه والعناية به" },
    customers: { en: "People booking hair and grooming appointments", ar: "من يحجزون مواعيد الشعر والعناية" },
  },
  {
    test: /\b(spas?|massages?|nails?|beauty)\b|سبا|مساج|أظافر/i,
    category: { en: "Beauty spa", ar: "سبا وتجميل" },
    services: { en: "Spa, beauty, and care treatments", ar: "جلسات السبا والتجميل والعناية" },
    description: { en: "A beauty spa", ar: "سبا للعناية والتجميل" },
    customers: { en: "People booking care and beauty treatments", ar: "من يحجزون جلسات العناية والتجميل" },
  },
  {
    test: /\b(clinics?|dentists?|dental|doctors?|pharmacy|pharmacies)\b|عيادة|طبيب|أسنان|صيدلية/i,
    category: { en: "Clinic", ar: "عيادة" },
    services: { en: "Clinical appointments and care", ar: "المواعيد والرعاية الطبية" },
    description: { en: "A clinic people visit for care", ar: "عيادة يقصدها الناس للرعاية" },
    customers: { en: "Patients booking appointments", ar: "المرضى الذين يحجزون مواعيد" },
  },
  {
    test: /\b(cafes?|café|coffee|restaurants?|bistros?|grills?|kitchens?)\b|مقهى|قهوة|مطعم/i,
    category: { en: "Cafe or restaurant", ar: "مقهى أو مطعم" },
    services: { en: "Food and drinks served on site", ar: "الطعام والمشروبات في المكان" },
    description: { en: "A place people come to eat or drink", ar: "مكان يأتيه الناس للأكل أو الشرب" },
    customers: { en: "Nearby guests looking for a place to eat or drink", ar: "الزبائن القريبون الباحثون عن مكان للأكل أو الشرب" },
  },
  {
    test: /\b(baker(?:y|ies)|patisseries?)\b|مخبز|حلويات/i,
    category: { en: "Bakery", ar: "مخبز" },
    services: { en: "Bread, pastries, and baked goods", ar: "الخبز والمعجنات والحلويات" },
    description: { en: "A bakery", ar: "مخبز" },
    customers: { en: "People buying fresh baked goods", ar: "من يشترون المخبوزات الطازجة" },
  },
  {
    test: /\b(gyms?|fitness|crossfit)\b|نادي|لياقة/i,
    category: { en: "Gym", ar: "نادي رياضي" },
    services: { en: "Training sessions and memberships", ar: "التدريب والاشتراكات" },
    description: { en: "A gym", ar: "نادي رياضي" },
    customers: { en: "People looking for a place to train", ar: "من يبحثون عن مكان للتدريب" },
  },
  {
    test: /\b(boutiques?|fashion|clothing|apparel)\b|بوتيك|أزياء|ملابس/i,
    category: { en: "Fashion boutique", ar: "بوتيك أزياء" },
    services: { en: "Clothing and styling", ar: "الملابس والتنسيق" },
    description: { en: "A fashion boutique", ar: "بوتيك للأزياء" },
    customers: { en: "Shoppers looking for clothes", ar: "المتسوقون الباحثون عن الملابس" },
  },
  {
    test: /\b(perfume|fragrance|cologne)\b|عطر|عطور/i,
    category: { en: "Fragrance", ar: "عطور" },
    services: { en: "Perfumes and scented products", ar: "العطور والمنتجات المعطّرة" },
    description: { en: "A fragrance business", ar: "عمل في العطور" },
    customers: { en: "People buying perfume", ar: "من يشترون العطور" },
  },
  {
    test: /\b(hotels?|resorts?)\b|فندق|منتجع/i,
    category: { en: "Hotel", ar: "فندق" },
    services: { en: "Stays and guest hospitality", ar: "الإقامة والضيافة" },
    description: { en: "A hotel", ar: "فندق" },
    customers: { en: "Guests looking for a place to stay", ar: "الضيوف الباحثون عن مكان للإقامة" },
  },
  {
    test: /\b(real\s*estate|realtors?|properties)\b|عقارات|عقار/i,
    category: { en: "Real estate", ar: "عقارات" },
    services: { en: "Property listings and viewings", ar: "العروض والزيارات العقارية" },
    description: { en: "A real estate business", ar: "عمل عقاري" },
    customers: { en: "People buying, selling, or renting property", ar: "من يشتري أو يبيع أو يستأجر عقاراً" },
  },
];

export function isAffirmation(text: string): boolean {
  return /^(yes|yeah|yep|yup|correct|right|ok|okay|sure|نعم|أيوه|ايوه|اي|صح|تمام)$/i.test(text.trim());
}

export function senseBusiness(text: string): BusinessSense | null {
  const value = text.trim();
  if (value.length < 3) return null;
  return TRADES.find((trade) => trade.test.test(value)) ?? null;
}

export function senseLine(name: string, sense: BusinessSense, language: "en" | "ar"): string {
  if (language === "ar") {
    return `فهمت ${name} كـ${sense.category.ar}، وسأذكر ${sense.services.ar}.`;
  }
  return `I’ll treat ${name} as a ${sense.category.en.toLowerCase()}, and remember ${sense.services.en.toLowerCase()}.`;
}
