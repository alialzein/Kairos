const SENTINEL_ORIGIN = "http://twin.invalid";

/** Same-origin absolute path only; anything else becomes "/". */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (/[\\\r\n\t]/.test(raw)) return "/";
  let url: URL;
  try {
    url = new URL(raw, SENTINEL_ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== SENTINEL_ORIGIN || url.pathname.startsWith("//")) return "/";
  const result = `${url.pathname}${url.search}${url.hash}`;
  // Re-parse exactly the way the call site will; any discrepancy means "/".
  try {
    if (new URL(result, SENTINEL_ORIGIN).origin !== SENTINEL_ORIGIN) return "/";
  } catch {
    return "/";
  }
  return result;
}
