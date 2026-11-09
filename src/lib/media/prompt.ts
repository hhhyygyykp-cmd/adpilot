import { detectCategory } from "../agent/context";
import { senseBusiness } from "../conversation/business-sense";
import type { Business, Campaign } from "../types";

export function buildImagePrompt(campaign: Campaign, business: Business): string {
  const subject = visualSubject(campaign, business);
  const lane = campaign.conceptSet?.concepts.find((item) => item.id === campaign.conceptSet?.selectedId)?.lane;
  const framing =
    lane === "appetite"
      ? "Tight close-up. The subject fills most of the frame."
      : lane === "lifestyle"
        ? "One person using the subject, photographed close, in the place that business actually operates."
        : "The subject is obvious in one glance.";
  return [
    visualScene(campaign, business, subject),
    `Subject: ${subject}.`,
    framing,
    "Photorealistic advertising photograph, natural light, sharp focus.",
    "No text, no letters, no numbers, no logo, no watermark, no caption, no signage.",
    physicalMust(campaign.mustAppear),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildVideoPrompt(campaign: Campaign, business: Business): string {
  return `${buildImagePrompt(campaign, business)} Slow camera push-in, real motion, the subject stays in frame.`;
}

function visualSubject(campaign: Campaign, business: Business): string {
  const product = campaign.productName?.trim() ?? "";
  const services = business.productsServices.trim();
  const category = business.category.trim();
  const vague = !product || /^(the\s+)?(offer|offering|product|item|ad|advertisement)s?$/i.test(product);
  if (vague) return services || category || business.name.trim() || "the product a customer would recognize";
  if (services && !services.toLowerCase().includes(product.toLowerCase())) return `${product}. ${services}`;
  return product;
}

function visualScene(campaign: Campaign, business: Business, subject: string): string {
  const blob = [
    business.name,
    business.category,
    business.productsServices,
    business.description,
    campaign.productName ?? "",
    campaign.originalPrompt ?? "",
  ].join(" ");
  const sensed = senseBusiness(blob)?.category.en.toLowerCase() ?? "";
  const label = `${sensed} ${business.category}`.toLowerCase();
  if (/hair|salon|barber/.test(label)) {
    return "A real hair salon. One client in the chair, a stylist finishing the cut, warm mirrors, the haircut sharp in the foreground.";
  }
  if (/spa|beauty|nail/.test(label)) {
    return "A quiet beauty studio. One treatment in progress, clean linens, soft daylight, the service in focus.";
  }
  if (/clinic|dental|pharmacy/.test(label)) {
    return "A calm clinic. One practitioner with one patient, clean light, no charts and no documents.";
  }
  if (/cafe|restaurant|bakery|food/.test(label) || detectCategory(blob) === "food") {
    return `Close, appetizing food photography of ${subject}. The dish is large, fresh, and in sharp focus.`;
  }
  if (/gym|fitness/.test(label)) {
    return "A working gym. One person mid-training, the equipment real and in focus, no posters.";
  }
  if (/fashion|boutique|clothing/.test(label)) {
    return "A fashion photograph of one outfit, boutique daylight, no tags and no labels.";
  }
  if (/fragrance|perfume/.test(label) || detectCategory(blob) === "fragrance") {
    return "A single glass perfume bottle, large and sharp, on a dark surface, one soft highlight. No printed label.";
  }
  if (/hotel/.test(label)) {
    return "A hotel interior a guest would want, daylight, one person at most, no brand type.";
  }
  if (/real estate|property/.test(label)) {
    return "A real home in daylight, the room in focus, no for-sale board.";
  }
  return `A clean commercial photograph of ${subject}, large in the frame, on a simple surface.`;
}

function physicalMust(value: string | null): string {
  const text = value?.trim() ?? "";
  if (!text || /price|discount|%|text|word|logo|slogan|offer/i.test(text)) return "";
  return `Also show ${text} as a physical object.`;
}
