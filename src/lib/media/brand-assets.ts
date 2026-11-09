import "server-only";

import { sql } from "../db";
import { readUpload } from "../storage";

export type BrandMedia = {
  logo: Buffer | null;
  product: Buffer | null;
};

export async function hasProductPhoto(customerId: string, businessId: string): Promise<boolean> {
  const rows = await sql<{ n: string }>(
    `select count(*)::text as n from business_assets
     where customer_id = $1 and business_id = $2 and kind = 'product_photo'`,
    [customerId, businessId],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export async function loadBrandMedia(customerId: string, businessId: string): Promise<BrandMedia> {
  const [logo, product] = await Promise.all([
    latestAsset(customerId, businessId, "logo"),
    latestAsset(customerId, businessId, "product_photo"),
  ]);
  return { logo, product };
}

export function realProductRequired(note: string | null, mustAppear: string | null, hasPhoto: boolean): boolean {
  if (hasPhoto) return true;
  return /photo|picture|upload|existing image|صورة|الصور/i.test(`${note ?? ""} ${mustAppear ?? ""}`);
}

async function latestAsset(customerId: string, businessId: string, kind: "logo" | "product_photo"): Promise<Buffer | null> {
  const rows = await sql<{ storage_key: string }>(
    `select storage_key from business_assets
     where customer_id = $1 and business_id = $2 and kind = $3
     order by created_at desc
     limit 1`,
    [customerId, businessId, kind],
  );
  const key = rows[0]?.storage_key;
  if (!key) return null;
  try {
    return await readUpload(key);
  } catch {
    return null;
  }
}
