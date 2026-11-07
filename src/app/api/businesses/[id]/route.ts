import { requireCustomer } from "@/lib/auth";
import { errorJson, json, readJson } from "@/lib/http";
import { isLanguage } from "@/lib/i18n";
import {
  getBusiness,
  listAssets,
  updateBusiness,
} from "@/lib/queries/businesses";
import type { BrandColors, Language } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const business = await getBusiness(auth.customer.id, id);
  if (!business) return errorJson("Business not found", 404);
  const assets = await listAssets(auth.customer.id, id);
  return json({ business, assets });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await ctx.params;
  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return errorJson("Invalid request");
  const language = isLanguage(body.preferredLanguage)
    ? (body.preferredLanguage as Language)
    : undefined;
  const updated = await updateBusiness(auth.customer.id, id, {
    name: typeof body.name === "string" ? body.name : undefined,
    category: typeof body.category === "string" ? body.category : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    productsServices:
      typeof body.productsServices === "string" ? body.productsServices : undefined,
    targetCustomers:
      typeof body.targetCustomers === "string" ? body.targetCustomers : undefined,
    location: typeof body.location === "string" ? body.location : undefined,
    website: typeof body.website === "string" ? body.website : undefined,
    publicContact: typeof body.publicContact === "string" ? body.publicContact : undefined,
    brandPersonality:
      typeof body.brandPersonality === "string" ? body.brandPersonality : undefined,
    marketingGoals:
      typeof body.marketingGoals === "string" ? body.marketingGoals : undefined,
    brandColors: (body.brandColors as BrandColors | undefined) ?? undefined,
    preferredLanguage: language,
    onboardingComplete: true,
  });
  if (!updated) return errorJson("Business not found", 404);
  return json({ business: updated });
}
