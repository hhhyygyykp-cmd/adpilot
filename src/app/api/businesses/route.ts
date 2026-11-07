import { requireCustomer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json } from "@/lib/http";
import { listBusinesses, startBusiness } from "@/lib/queries/businesses";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const businesses = await listBusinesses(auth.customer.id);
  return json({ businesses });
}

export async function POST(request: Request) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  const business = await startBusiness(auth.customer.id, auth.customer.preferredLanguage);
  await audit({
    actorCustomerId: auth.customer.id,
    action: "business.start",
    entityType: "business",
    entityId: business.id,
  });
  return json({ business }, 201);
}
