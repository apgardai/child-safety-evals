/** Build a `custom-*` registry alias from a human-readable name. */
export function slugifyCustomModelName(displayName: string): string {
  const part = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `custom-${part || "model"}`;
}

/** Pick a registry alias that does not collide with existing models. */
export function uniqueCustomModelSlug(displayName: string, existingAliases: string[]): string {
  const base = slugifyCustomModelName(displayName);
  if (!existingAliases.includes(base)) return base;
  let n = 2;
  while (existingAliases.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
