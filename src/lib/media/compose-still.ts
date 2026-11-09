import sharp from "sharp";

const WIDTH = 1080;
const HEIGHT = 1350;

export type AdLayout = {
  photo: Buffer;
  logo?: Buffer | null;
  businessName: string;
  headline: string;
  supportingCopy: string;
  offer: string | null;
  cta: string;
};

export async function composeStillAd(input: AdLayout): Promise<Buffer> {
  const photo = await sharp(input.photo)
    .rotate()
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "attention" })
    .toBuffer();
  const layers: { input: Buffer; top: number; left: number }[] = [{ input: Buffer.from(overlaySvg(input)), top: 0, left: 0 }];
  if (input.logo) {
    const logo = await sharp(input.logo)
      .resize(148, 148, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    layers.push({ input: logo, top: 48, left: 48 });
  }
  return sharp(photo).composite(layers).jpeg({ quality: 90 }).toBuffer();
}

function overlaySvg(input: AdLayout): string {
  const headline = wrap(input.headline, 16, 2);
  const support = wrap(input.supportingCopy, 34, 2);
  const offer = input.offer ? escapeXml(input.offer) : "";
  const cta = escapeXml(input.cta);
  const name = escapeXml(input.businessName);
  const nameX = input.logo ? 220 : 64;
  const headlineStart = offer ? 980 : 1040;
  const headlineLines = headline
    .map((line, index) => text(escapeXml(line), 64, headlineStart + index * 74, 64, "700", "#fffef8"))
    .join("");
  const supportStart = headlineStart + headline.length * 74 + 8;
  const supportLines = support
    .map((line, index) => text(escapeXml(line), 64, supportStart + index * 40, 30, "500", "#f3ead7"))
    .join("");
  const offerLine = offer ? text(offer, 64, headlineStart - 58, 28, "700", "#e6c27a") : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.28"/>
      <stop offset="0.42" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.62" stop-color="#000" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.86"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#shade)"/>
  <text x="${nameX}" y="96" font-family="Inter, DejaVu Sans, sans-serif" font-size="28" font-weight="700" fill="#fffef8">${name}</text>
  ${offerLine}
  ${headlineLines}
  ${supportLines}
  <rect x="64" y="1216" width="952" height="92" rx="46" fill="#e6c27a"/>
  <text x="540" y="1274" text-anchor="middle" font-family="Inter, DejaVu Sans, sans-serif" font-size="34" font-weight="700" fill="#1a140c">${cta}</text>
</svg>`;
}

function text(value: string, x: number, y: number, size: number, weight: string, fill: string): string {
  return `<text x="${x}" y="${y}" font-family="Inter, DejaVu Sans, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${value}</text>`;
}

function wrap(value: string, width: number, maxLines: number): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines.length ? lines : [""];
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/…$/, "")}…`;
  return kept;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
