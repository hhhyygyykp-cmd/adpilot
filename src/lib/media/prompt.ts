import { brandForCopy, detectCategory } from "../agent/context";
import type { Business, Campaign } from "../types";

export function buildImagePrompt(campaign: Campaign, business: Business): string {
  const product = campaign.productName?.trim() || "the named product";
  const prompt = campaign.originalPrompt ?? "";
  const brand = brandForCopy({
    prompt,
    productName: campaign.productName,
    business,
  });
  const category = detectCategory(`${prompt} ${product}`);
  const concept = campaign.conceptSet?.concepts.find((item) => item.id === campaign.conceptSet?.selectedId);
  const price = campaign.offer ? ` Any price text must read exactly ${campaign.offer}.` : "";
  const must = campaign.mustAppear ? ` Also include: ${campaign.mustAppear}.` : "";

  if (category === "fragrance") {
    const setting =
      concept?.lane === "lifestyle"
        ? "on a vanity at dusk, a hand may rest beside the bottle"
        : "on a dark studio table";
    return [
      `Product advertisement photograph of ${product} perfume.`,
      `Hero subject: the ${product} glass perfume bottle, large and sharp in the center of the frame ${setting}.`,
      "Commercial still life, photorealistic studio lighting, bottle label readable.",
      `${price}${must}`.trim(),
    ]
      .filter(Boolean)
      .join(" ");
  }

  const named = brand ? `${brand} ${product}` : product;
  const direction = concept?.creativeDirection ? ` ${concept.creativeDirection}` : "";
  return `Product advertisement photograph of ${named}. The named product is the hero of the frame, large and sharp in the foreground.${direction}${price}${must} Photorealistic, high-end commercial lighting.`
    .replace(/\s+/g, " ")
    .trim();
}

export function buildVideoPrompt(campaign: Campaign, business: Business): string {
  return `${buildImagePrompt(campaign, business)} Slow camera push-in, real motion, the named product stays in frame.`;
}
