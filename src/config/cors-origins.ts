/** Expand "3000" / ":59012" / full URLs into CORS origin strings. */
export function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  return raw.split(',').flatMap((entry) => {
    const value = entry.trim();
    if (!value) return [];

    if (/^\d+$/.test(value)) {
      return [`http://localhost:${value}`];
    }

    if (value.startsWith(':') && /^:\d+$/.test(value)) {
      return [`http://localhost${value}`];
    }
    return [value];
  });
}
