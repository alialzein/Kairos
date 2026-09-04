export const PUBLIC_PREFIXES = ["/login", "/auth", "/bench"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
