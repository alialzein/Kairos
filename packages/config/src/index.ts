export const CONFIG_PACKAGE = "@twin/config";
// `identity.ts` reads identity.yaml via node:fs at module scope. It is intentionally NOT
// re-exported from this barrel: apps/web's client components (avatar/*) import from "@twin/config"
// directly, and Turbopack bundles a transpiled package's whole barrel graph into the browser chunk —
// pulling in node:fs there fails the build ("chunking context does not support external modules").
// Node-only callers should import from "@twin/config/identity" instead (see package.json exports);
// the generated, fs-free `identity` data constant below remains safe for client code.
export { identity } from "./identity.generated";
export * from "./avatar";
