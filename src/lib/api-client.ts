export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function csrfFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )adpilot_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const csrf = csrfFromCookie();
    if (csrf) headers.set("x-csrf-token", csrf);
    if (!headers.has("content-type") && init.body && !(init.body instanceof FormData)) {
      headers.set("content-type", "application/json");
    }
  }
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new ApiError(data.error || "Request failed", response.status);
  }
  return data;
}
