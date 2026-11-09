import "server-only";

import { newId } from "../crypto";
import { sql } from "../db";
import { testingBudgetUsd, type FalKind } from "./fal-models";

export type FalJobStatus = "queued" | "in_progress" | "completed" | "failed";

export type FalJob = {
  id: string;
  kind: FalKind;
  modelId: string;
  prompt: string;
  status: FalJobStatus;
  requestId: string | null;
  mediaUrls: string[];
  costUsd: number;
  error: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  kind: FalKind;
  model_id: string;
  prompt: string;
  status: FalJobStatus;
  request_id: string | null;
  media_urls: unknown;
  cost_usd: string | number;
  error: string | null;
  created_at: string;
};

export async function reserveFalJob(input: {
  customerId: string;
  kind: FalKind;
  modelId: string;
  prompt: string;
  settings: Record<string, unknown>;
  costUsd: number;
}): Promise<FalJob | null> {
  const id = newId();
  const rows = await sql<Row>(
    `with spent as (
       select coalesce(sum(cost_usd), 0)::numeric as total
       from fal_generations
       where customer_id = $1
         and status in ('queued', 'in_progress', 'completed')
     )
     insert into fal_generations (
       id, customer_id, kind, model_id, prompt, settings, status, cost_usd
     )
     select $2, $1, $3, $4, $5, $6::jsonb, 'queued', $7
     from spent
     where spent.total + $7::numeric <= $8::numeric
     returning id, kind, model_id, prompt, status, request_id, media_urls, cost_usd, error, created_at`,
    [
      input.customerId,
      id,
      input.kind,
      input.modelId,
      input.prompt,
      JSON.stringify(input.settings),
      input.costUsd,
      testingBudgetUsd(),
    ],
  );
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function attachFalRequest(id: string, requestId: string) {
  await sql(`update fal_generations set request_id = $2, updated_at = now() where id = $1`, [id, requestId]);
}

export async function finishFalJob(id: string, status: FalJobStatus, mediaUrls: string[], error: string | null) {
  await sql(
    `update fal_generations
     set status = $2,
         media_urls = $3::jsonb,
         error = $4,
         cost_usd = case when $2 = 'failed' then 0 else cost_usd end,
         updated_at = now()
     where id = $1`,
    [id, status, JSON.stringify(mediaUrls), error],
  );
}

export async function findFalJob(customerId: string, kind: FalKind, requestId: string): Promise<FalJob | null> {
  const rows = await sql<Row>(
    `select id, kind, model_id, prompt, status, request_id, media_urls, cost_usd, error, created_at
     from fal_generations
     where customer_id = $1 and kind = $2 and request_id = $3
     limit 1`,
    [customerId, kind, requestId],
  );
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function readFalJob(id: string): Promise<FalJob | null> {
  const rows = await sql<Row>(
    `select id, kind, model_id, prompt, status, request_id, media_urls, cost_usd, error, created_at
     from fal_generations where id = $1 limit 1`,
    [id],
  );
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function listFalJobs(customerId: string, kind: FalKind): Promise<FalJob[]> {
  const rows = await sql<Row>(
    `select id, kind, model_id, prompt, status, request_id, media_urls, cost_usd, error, created_at
     from fal_generations
     where customer_id = $1 and kind = $2
     order by created_at desc
     limit 12`,
    [customerId, kind],
  );
  return rows.map(mapJob);
}

export async function falBudget(customerId: string) {
  const rows = await sql<{ spent: string | number }>(
    `select coalesce(sum(cost_usd), 0) as spent
     from fal_generations
     where customer_id = $1 and status in ('queued', 'in_progress', 'completed')`,
    [customerId],
  );
  const spent = Number(rows[0]?.spent ?? 0);
  const limit = testingBudgetUsd();
  return {
    limitUsd: limit,
    spentUsd: Number(spent.toFixed(6)),
    remainingUsd: Number(Math.max(0, limit - spent).toFixed(6)),
  };
}

function mapJob(row: Row): FalJob {
  const urls = Array.isArray(row.media_urls)
    ? row.media_urls.filter((item): item is string => typeof item === "string")
    : [];
  return {
    id: row.id,
    kind: row.kind,
    modelId: row.model_id,
    prompt: row.prompt,
    status: row.status,
    requestId: row.request_id,
    mediaUrls: urls,
    costUsd: Number(row.cost_usd),
    error: row.error,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
