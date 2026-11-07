import "server-only";

import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

type GlobalDb = {
  pool?: pg.Pool;
  local?: Promise<PGlite>;
};

const globalForDb = globalThis as typeof globalThis & { __adpilotDb?: GlobalDb };
const store: GlobalDb = globalForDb.__adpilotDb ?? {};
globalForDb.__adpilotDb = store;

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    store.pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await store.pool.query(text, params)).rows as T[];
  }
  store.local ??= startLocal().catch((error: unknown) => {
    store.local = undefined;
    throw error;
  });
  return (await (await store.local).query<T>(text, params)).rows;
}

async function startLocal(): Promise<PGlite> {
  const dataDir = path.join(process.cwd(), "data", "pglite");
  await mkdir(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  await db.waitReady;
  await db.exec(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
  const files = (await readdir("migrations").catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const applied = await db.query<{ name: string }>(
      "select name from schema_migrations where name = $1",
      [file],
    );
    if (applied.rows.length > 0) continue;
    await db.exec(await readFile(path.join("migrations", file), "utf8"));
    await db.query("insert into schema_migrations (name) values ($1)", [file]);
  }
  return db;
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}
