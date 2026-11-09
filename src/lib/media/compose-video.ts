import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import type { AdLayout } from "./compose-still";

const FONT = [
  "/usr/share/fonts/truetype/macos/Inter-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/Library/Fonts/Arial Bold.ttf",
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
].find((file) => existsSync(file));

export async function composeVideoAd(input: Omit<AdLayout, "photo"> & { footage: Buffer }): Promise<Buffer> {
  if (!FONT) throw new Error("The video could not be edited because no advertisement font is installed.");
  const dir = await mkdtemp(path.join(tmpdir(), "adpilot-ad-"));
  try {
    const source = path.join(dir, isMp4(input.footage) ? "footage.mp4" : "photo.jpg");
    const logo = path.join(dir, "logo.png");
    const output = path.join(dir, "ad.mp4");
    await writeFile(source, input.footage);
    if (input.logo) await writeFile(logo, input.logo);
    const middle = isMp4(input.footage)
      ? "[0:v]scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350,fps=30,trim=duration=5,setpts=PTS-STARTPTS[move]"
      : "[0:v]scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350,zoompan=z='min(zoom+0.0012,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=1080x1350:fps=30,trim=duration=5,setpts=PTS-STARTPTS[move]";
    const logoChain = input.logo
      ? `;[1:v]scale=140:-1[lg];[move][lg]overlay=48:48[placed]`
      : "";
    const placed = input.logo ? "placed" : "move";
    const headline = escapeDrawtext(input.headline);
    const support = escapeDrawtext(input.supportingCopy);
    const offer = input.offer ? escapeDrawtext(input.offer) : "";
    const cta = escapeDrawtext(input.cta);
    const name = escapeDrawtext(input.businessName);
    const font = escapeDrawtext(FONT);
    const filter = [
      middle,
      logoChain,
      `color=c=0x120e0b:s=1080x1350:d=1.4,format=yuv420p[intro]`,
      `[intro]${draw(font, name, 42, "(w-text_w)/2", "h*0.38", "white")}[i1]`,
      `[i1]${draw(font, headline, 64, "(w-text_w)/2", "h*0.48", "white")}[i2]`,
      `[${placed}]drawbox=y=ih-460:w=iw:h=460:color=black@0.55:t=fill[panel]`,
      offer ? `[panel]${draw(font, offer, 32, "64", "h-390", "0xe6c27a")}[p1]` : "",
      `[${offer ? "p1" : "panel"}]${draw(font, headline, 52, "64", "h-300", "white")}[p2]`,
      `[p2]${draw(font, support, 28, "64", "h-220", "0xf3ead7")}[p3]`,
      `[p3]drawbox=x=64:y=ih-160:w=iw-128:h=96:color=0xe6c27a:t=fill[p4]`,
      `[p4]${draw(font, cta, 34, "(w-text_w)/2", "h-98", "0x1a140c")}[mid]`,
      `color=c=0x120e0b:s=1080x1350:d=1.8,format=yuv420p[end0]`,
      `[end0]${draw(font, name, 36, "(w-text_w)/2", "h*0.38", "0xe6c27a")}[e1]`,
      `[e1]${draw(font, cta, 58, "(w-text_w)/2", "h*0.50", "white")}[end]`,
      `[i2][mid][end]concat=n=3:v=1:a=0[v]`,
    ]
      .filter(Boolean)
      .join(";");
    const args = ["-y", "-i", source];
    if (input.logo) args.push("-i", logo);
    args.push(
      "-filter_complex",
      filter,
      "-map",
      "[v]",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      output,
    );
    await runFfmpeg(args);
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function draw(font: string, text: string, size: number, x: string, y: string, color: string): string {
  return `drawtext=fontfile='${font}':text='${text}':fontsize=${size}:fontcolor=${color}:x=${x}:y=${y}`;
}

function escapeDrawtext(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/%/g, "\\%");
}

function isMp4(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let error = "";
    child.stderr.on("data", (chunk) => {
      error = `${error}${chunk.toString()}`.slice(-2000);
    });
    child.on("error", () => reject(new Error("The video could not be edited into an advertisement on this computer.")));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`The video could not be edited into an advertisement on this computer. ${error.trim().slice(-280)}`));
    });
  });
}
