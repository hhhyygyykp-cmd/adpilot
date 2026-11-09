export type Language = "en" | "ar";

export type Customer = {
  id: string;
  email: string;
  name: string;
  preferredLanguage: Language;
  isAdmin: boolean;
  createdAt: string;
};

export type BrandColors = {
  primary?: string;
  secondary?: string;
  accent?: string;
};

export type ChatMessage = {
  id: string;
  role: "agent" | "customer";
  text: string;
  at: string;
  field?: string;
  skipped?: boolean;
};

export type Business = {
  id: string;
  customerId: string;
  name: string;
  category: string;
  description: string;
  productsServices: string;
  targetCustomers: string;
  location: string;
  website: string;
  publicContact: string;
  brandPersonality: string;
  marketingGoals: string;
  brandColors: BrandColors;
  preferredLanguage: Language;
  isActive: boolean;
  onboardingComplete: boolean;
  onboardingState: BusinessOnboardingState;
  createdAt: string;
  updatedAt: string;
  assetCounts?: { logo: number; productPhoto: number };
};

export type BusinessOnboardingState = {
  messages: ChatMessage[];
  awaiting: string | null;
};

export type BusinessAsset = {
  id: string;
  businessId: string;
  kind: "logo" | "product_photo";
  originalName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
};

export type FormatPreference = "image" | "video" | "both" | "ai_recommend";

export type CampaignStatus = "drafting" | "brief_ready" | "confirmed";

export type CampaignFacts = {
  productName: string | null;
  offer: string | null;
  objective: string | null;
  formatPreference: FormatPreference | null;
  existingPhotosNote: string | null;
  mustAppear: string | null;
  audienceNote: string | null;
};

export type GenerationStatus = "not_started" | "generating" | "ready" | "failed";

export type InterpretedBrief = CampaignFacts & {
  businessName: string;
  sourcePrompt: string;
  missing: string[];
  interpreter: string;
  generation: GenerationStatus;
};

export type CampaignCreative = {
  id: string;
  campaignId: string;
  kind: "image" | "video";
  provider: string;
  prompt: string;
  mimeType: string;
  byteSize: number;
  originalName: string;
  note: string;
  createdAt: string;
};

export type MediaQuoteLine = {
  provider: "fal";
  model: string;
  label: string;
  usd: number;
  remaining: number;
  limit: number;
  seconds?: number;
};

export type MediaQuote = {
  keyConfigured: boolean;
  waitingForKey: boolean;
  wantsVideo: boolean;
  chargesStill: boolean;
  chargesVideo: boolean;
  still: MediaQuoteLine;
  video: MediaQuoteLine | null;
  totalUsd: number;
};

export type MemoryKind =
  | "verified_fact"
  | "preference"
  | "campaign_history"
  | "measured_insight"
  | "hypothesis";

export type MemoryEntry = {
  id: string;
  businessId: string;
  sourceCampaignId: string | null;
  kind: MemoryKind;
  label: string;
  value: string;
  evidence: string;
  createdAt: string;
};

export type HistoryItem = {
  campaignId: string;
  productName: string | null;
  offer: string | null;
  objective: string | null;
  status: CampaignStatus;
  originalPrompt: string;
  createdAt: string;
};

export type VerifiedFact = {
  fact: string;
  source: string;
};

export type ConceptLane = "appetite" | "offer" | "lifestyle";

export type MarketingConcept = {
  id: ConceptLane;
  lane: ConceptLane;
  title: string;
  hook: string;
  headline?: string;
  supportingCopy?: string;
  coreMessage: string;
  audienceBenefit: string;
  creativeDirection: string;
  recommendedFormat: "image" | "video";
  cta: string;
};

export type ConceptSet = {
  concepts: MarketingConcept[];
  recommendedId: ConceptLane | "";
  recommendationReason: string;
  selectedId: ConceptLane | null;
  chosenBy: "customer" | "ai" | null;
};

export type MarketingPlan = {
  objective: string | null;
  verifiedFacts: VerifiedFact[];
  preferences: Array<{ label: string; value: string }>;
  history: HistoryItem[];
  measuredInsights: Array<{ label: string; value: string; available: false }>;
  hypotheses: Array<{ claim: string; basis: string }>;
  audience: string;
  angle: string;
  framework: {
    id: string;
    name: string;
    reason: string;
  } | null;
  hooks: string[];
  creativeDirection: string;
  cta: string;
  missing: string[];
  evidence: string[];
  toolsUsed: string[];
  orchestrator: string;
  reusedFromHistory: string[];
  historyNote: string;
};

export type Campaign = {
  id: string;
  customerId: string;
  businessId: string;
  businessName?: string;
  status: CampaignStatus;
  originalPrompt: string;
  productName: string | null;
  offer: string | null;
  objective: string | null;
  formatPreference: FormatPreference | null;
  existingPhotosNote: string | null;
  mustAppear: string | null;
  audienceNote: string | null;
  conversation: ChatMessage[];
  interpretedBrief: InterpretedBrief | Record<string, never>;
  marketingPlan: MarketingPlan | null;
  conceptSet: ConceptSet | null;
  creatives: CampaignCreative[];
  generationStatus: GenerationStatus;
  generationNote: string;
  paidImageCount: number;
  paidVideoCount: number;
  mediaQuote: MediaQuote;
  interpreter: string;
  awaiting: string | null;
  createdAt: string;
  updatedAt: string;
};

export const SESSION_COOKIE = "adpilot_session";
export const CSRF_COOKIE = "adpilot_csrf";
export const LANG_COOKIE = "adpilot_lang";
export const SESSION_DAYS = 14;
