import "server-only";

import { newId } from "../crypto";
import { sql } from "../db";
import type { MemoryEntry, MemoryKind } from "../types";

type Row = {
  id: string;
  business_id: string;
  source_campaign_id: string | null;
  kind: MemoryKind;
  label: string;
  value: string;
  evidence: string;
  source?: string | null;
  confidence?: string | null;
  retrieved_at?: string | null;
  created_at: string;
};

function mapRow(row: Row): MemoryEntry {
  return {
    id: row.id,
    businessId: row.business_id,
    sourceCampaignId: row.source_campaign_id,
    kind: row.kind,
    label: row.label,
    value: row.value,
    evidence: row.evidence,
    source: row.source ?? "",
    confidence: row.confidence ?? "",
    retrievedAt: row.retrieved_at ? new Date(row.retrieved_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listMemory(customerId: string, businessId: string): Promise<MemoryEntry[]> {
  const rows = await sql<Row>(
    `select id, business_id, source_campaign_id, kind, label, value, evidence,
            coalesce(source, '') as source, coalesce(confidence, '') as confidence, retrieved_at, created_at
     from business_memory
     where customer_id = $1 and business_id = $2
     order by created_at desc
     limit 80`,
    [customerId, businessId],
  );
  return rows.map(mapRow);
}

export async function insertMemory(input: {
  customerId: string;
  businessId: string;
  sourceCampaignId: string | null;
  kind: MemoryKind;
  label: string;
  value: string;
  evidence: string;
  source?: string;
  confidence?: string;
  retrievedAt?: string | null;
}) {
  await sql(
    `insert into business_memory (
       id, customer_id, business_id, source_campaign_id, kind, label, value, evidence, source, confidence, retrieved_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      newId(),
      input.customerId,
      input.businessId,
      input.sourceCampaignId,
      input.kind,
      input.label,
      input.value,
      input.evidence,
      input.source ?? "",
      input.confidence ?? "",
      input.retrievedAt ?? null,
    ],
  );
}

export async function deleteMemoryByKind(
  customerId: string,
  businessId: string,
  kind: MemoryKind,
) {
  await sql(
    `delete from business_memory where customer_id = $1 and business_id = $2 and kind = $3`,
    [customerId, businessId, kind],
  );
}

export async function rememberConfirmedBrief(input: {
  customerId: string;
  businessId: string;
  campaignId: string;
  businessName: string;
  productName: string | null;
  offer: string | null;
  objective: string | null;
  formatPreference: string | null;
  prompt: string;
  hypotheses: Array<{ claim: string; basis: string }>;
  conceptTitle?: string | null;
  conceptChosenBy?: string | null;
}) {
  const facts: Array<[string, string, string]> = [];
  if (input.businessName) {
    facts.push(["Business name", input.businessName, "Saved business profile"]);
  }
  if (input.productName) {
    facts.push(["Product", input.productName, "Customer brief"]);
  }
  if (input.offer) {
    facts.push(["Offer", input.offer, "Customer brief"]);
  }
  if (input.objective) {
    facts.push(["Objective", input.objective, "Customer brief"]);
  }
  for (const [label, value, evidence] of facts) {
    await insertMemory({
      customerId: input.customerId,
      businessId: input.businessId,
      sourceCampaignId: input.campaignId,
      kind: "verified_fact",
      label,
      value,
      evidence,
    });
  }
  if (input.formatPreference) {
    await insertMemory({
      customerId: input.customerId,
      businessId: input.businessId,
      sourceCampaignId: input.campaignId,
      kind: "preference",
      label: "Format",
      value: input.formatPreference,
      evidence: "Stated on this brief",
    });
  }
  if (input.conceptTitle) {
    await insertMemory({
      customerId: input.customerId,
      businessId: input.businessId,
      sourceCampaignId: input.campaignId,
      kind: "preference",
      label: "Chosen concept",
      value: input.conceptTitle,
      evidence:
        input.conceptChosenBy === "ai" ? "Customer let AdPilot choose" : "Customer picked this concept",
    });
  }
  await insertMemory({
    customerId: input.customerId,
    businessId: input.businessId,
    sourceCampaignId: input.campaignId,
    kind: "campaign_history",
    label: "Saved brief",
    value: [input.productName, input.offer, input.objective].filter(Boolean).join(" · ") || input.prompt,
    evidence: `Prompt: ${input.prompt}`,
  });
  for (const item of input.hypotheses) {
    await insertMemory({
      customerId: input.customerId,
      businessId: input.businessId,
      sourceCampaignId: input.campaignId,
      kind: "hypothesis",
      label: "Working assumption",
      value: item.claim,
      evidence: item.basis,
    });
  }
}
