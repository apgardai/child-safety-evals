/**
 * Turns taxonomy-style ids (e.g. curiosity_and_early_exploration) into readable titles.
 */
export function humanizeSlug(value: string | undefined): string {
  const s = (value ?? "").trim();
  if (!s) return "—";
  return s
    .split(/_+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
