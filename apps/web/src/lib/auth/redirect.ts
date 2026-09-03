export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  // same-origin absolute path only: starts with exactly one "/" and no scheme/host
  return /^\/(?!\/)/.test(raw) && !/[\r\n]/.test(raw) ? raw : "/";
}
