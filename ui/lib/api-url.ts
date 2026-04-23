function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = process.env.NEXT_PUBLIC_INTERNAL_API_URL?.trim();
  if (!base) return p;
  return `${stripTrailingSlash(base)}${p}`;
}
