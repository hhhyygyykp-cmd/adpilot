export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  let path = value.trim();
  if (!path) return "/";
  try {
    path = decodeURIComponent(path);
  } catch {
    return "/";
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  if (path.includes("\\") || path.includes(":") || path.includes("@")) return "/";
  if (/[\u0000-\u001F\u007F]/.test(path)) return "/";
  return path;
}
