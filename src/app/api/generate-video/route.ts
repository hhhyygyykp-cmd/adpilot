import { handleFalRoute } from "@/lib/media/fal-route";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export function GET(request: Request) {
  return handleFalRoute(request, "video");
}

export function POST(request: Request) {
  return handleFalRoute(request, "video");
}
