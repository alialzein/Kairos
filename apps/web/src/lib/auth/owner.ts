export function parseOwnerIds(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isOwner(userId: string | undefined, owners: ReadonlySet<string>): boolean {
  return userId !== undefined && owners.has(userId);
}

export function ownerIdsFromEnv(): ReadonlySet<string> {
  return parseOwnerIds(process.env.OWNER_USER_IDS);
}
