/** Display label for benchmark prompt variant values stored as `default` | `child`. */
export function formatPromptVariantLabel(prompt: string | undefined): string {
  const p = (prompt ?? "").trim().toLowerCase();
  if (p === "child") return "Child-aware";
  if (p === "default") return "Assistant";
  if (!p) return "—";
  return p.charAt(0).toUpperCase() + p.slice(1);
}
