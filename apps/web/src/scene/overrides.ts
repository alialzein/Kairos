/**
 * Bench-only tuning overrides: `?set=contours.frequency:40,core.radius:0.5` applies numeric (or
 * boolean/string) values to dotted paths of a config object before the scene mounts, so a single
 * property can be re-screenshotted without editing sceneConfig.ts (the plan's per-property
 * feedback loop). Unknown paths and unparsable values are ignored. Returns the list applied.
 */
export function applyOverrides(target: object, spec: string | undefined): string[] {
  const applied: string[] = [];
  if (!spec) return applied;
  for (const item of spec.split(",")) {
    const i = item.indexOf(":");
    if (i <= 0) continue;
    const path = item.slice(0, i).trim().split(".");
    const raw = item.slice(i + 1).trim();
    const last = path.pop();
    if (!last) continue;
    let node: unknown = target;
    for (const key of path) {
      if (node !== null && typeof node === "object" && key in node)
        node = (node as Record<string, unknown>)[key];
      else node = undefined;
    }
    if (node === null || typeof node !== "object" || !(last in node)) continue;
    const obj = node as Record<string, unknown>;
    const current = obj[last];
    let value: unknown;
    if (typeof current === "number") {
      value = Number(raw);
      if (!Number.isFinite(value)) continue;
    } else if (typeof current === "boolean") value = raw === "true" || raw === "1";
    else if (typeof current === "string") value = raw;
    else if (Array.isArray(current) && current.every((v) => typeof v === "number")) {
      // vectors: `core.center:0|1.3|0.5`
      const parts = raw.split("|").map(Number);
      if (parts.length !== current.length || parts.some((v) => !Number.isFinite(v))) continue;
      value = parts;
    } else continue;
    obj[last] = value;
    applied.push(`${[...path, last].join(".")}=${String(value)}`);
  }
  return applied;
}
