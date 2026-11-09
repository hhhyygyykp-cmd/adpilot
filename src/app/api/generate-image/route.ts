import { handleFalRoute } from "@/lib/media/fal-route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function GET(request: Request) {
  return handleFalRoute(request, "image");
}

export function POST(request: Request) {
  return handleFalRoute(request, "image");
}
