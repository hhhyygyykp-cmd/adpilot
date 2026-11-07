import { newId } from "./crypto";
import { sql } from "./db";

export async function audit(input: {
  actorCustomerId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await sql(
    `insert into audit_log (id, actor_customer_id, action, entity_type, entity_id, metadata)
     values ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      newId(),
      input.actorCustomerId ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
