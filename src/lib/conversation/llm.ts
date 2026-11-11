import { rateLimit } from "../rate-limit";
import type { Business, CampaignFacts } from "../types";
import { emptyFacts } from "./extract";

export type InterpretInput = {
  prompt: string;
  business: Business | null;
  language: "en" | "ar";
};

export interface LlmProvider {
  readonly id: string;
  isConfigured(): boolean;
  interpret(input: InterpretInput): Promise<Partial<CampaignFacts> | null>;
}

function parseFacts(raw: unknown): Partial<CampaignFacts> | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const format = data.formatPreference;
  const allowed = ["image", "video", "both", "ai_recommend"];
  return {
    productName: typeof data.productName === "string" ? data.productName : null,
    offer: typeof data.offer === "string" ? data.offer : null,
    objective: typeof data.objective === "string" ? data.objective : null,
    formatPreference:
      typeof format === "string" && allowed.includes(format)
        ? (format as CampaignFacts["formatPreference"])
        : null,
    existingPhotosNote:
      typeof data.existingPhotosNote === "string" ? data.existingPhotosNote : null,
    mustAppear: typeof data.mustAppear === "string" ? data.mustAppear : null,
  };
}

export class UnconfiguredLlmProvider implements LlmProvider {
  readonly id = "none";
  isConfigured() {
    return false;
  }
  async interpret(): Promise<Partial<CampaignFacts> | null> {
    return null;
  }
}

export class OpenAiLlmProvider implements LlmProvider {
  readonly id = "openai";
  isConfigured() {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }
  async interpret(input: InterpretInput): Promise<Partial<CampaignFacts> | null> {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) return null;
    const actor = input.business?.customerId || "shared";
    const limited = await rateLimit(`openai:${actor}`, 40, 60 * 60 * 1000);
    if (!limited.ok) return null;
    const businessContext = input.business
      ? `Business: ${input.business.name}. Products/services: ${input.business.productsServices}. Goals: ${input.business.marketingGoals}.`
      : "No business profile.";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extract advertising brief fields from the customer. Never invent prices, offers, or product facts. If a field is not stated, use null. Return JSON with productName, offer, objective, formatPreference (image|video|both|ai_recommend|null), existingPhotosNote, mustAppear.",
          },
          {
            role: "user",
            content: `${businessContext}\nLanguage: ${input.language}\nRequest:\n${input.prompt}`,
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;
    try {
      return parseFacts(JSON.parse(content));
    } catch {
      return null;
    }
  }
}

export function getLlmProvider(): LlmProvider {
  const openai = new OpenAiLlmProvider();
  if (openai.isConfigured()) return openai;
  return new UnconfiguredLlmProvider();
}

export function interpreterLabel(provider: LlmProvider): string {
  return provider.isConfigured() ? provider.id : "structured";
}

export { emptyFacts };
