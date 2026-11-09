import { createHash } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
let pool: pg.Pool | undefined;

const lookup = `select 1 as ok from sessions where token_hash = $1 and expires_at > now() limit 1`;

export async function hasValidSession(token: string | undefined): Promise<boolean> {
  if (!token || !/^[A-Za-z0-9_-]{20,}$/.test(token)) return false;
  const hash = createHash("sha256").update(token).digest("hex");
  try {
    if (databaseUrl) {
      pool ??= new pg.Pool({ connectionString: databaseUrl, max: 2 });
      const result = await pool.query(lookup, [hash]);
      return (result.rowCount ?? 0) > 0;
    }
    const { sql } = await import("./db");
    const rows = await sql(lookup, [hash]);
    return rows.length > 0;
  } catch {
    return false;
  }
}
