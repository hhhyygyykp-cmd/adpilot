import "server-only";

import { requireCustomer } from "../auth";
import { errorJson, json, readJson } from "../http";
import { clientKey, rateLimit } from "../rate-limit";
import { FAL_RATE_LIMITS, type FalKind } from "./fal-models";
import { FalRequestError, falAccount, startFalGeneration, syncFalGeneration } from "./fal-service";
import { falBudget } from "./fal-jobs";

export async function handleFalRoute(request: Request, kind: FalKind) {
  const auth = await requireCustomer(request);
  if ("error" in auth && auth.error) return auth.error;
  try {
    if (request.method === "GET") {
      const requestId = new URL(request.url).searchParams.get("requestId")?.trim();
      if (!requestId) return json(await falAccount(auth.customer.id, kind));
      const job = await syncFalGeneration(auth.customer.id, kind, requestId);
      return json({ job, budget: await falBudget(auth.customer.id) });
    }
    const rule = FAL_RATE_LIMITS[kind];
    const limited = await rateLimit(clientKey(request, `fal:${kind}:${auth.customer.id}`), rule.limit, rule.windowMs);
    if (!limited.ok) return errorJson("Too many generations. Try again shortly.", 429);
    const body = await readJson(request);
    const job = await startFalGeneration(auth.customer.id, kind, body);
    return json({ job, budget: await falBudget(auth.customer.id) }, job.status === "failed" ? 502 : 200);
  } catch (error) {
    if (error instanceof FalRequestError) return errorJson(error.message, error.status);
    return errorJson("Generation failed", 500);
  }
}
