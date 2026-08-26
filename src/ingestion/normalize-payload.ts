export interface NormalizedPayloadFields {
  title: string;
  summary: string | null;
  url: string;
  language: string;
  languageConfidence: number | null;
  publishedAt: Date | null;
}

export function cleanDisplayText(value: string): string {
  const withoutTags = value.replace(/<[^>]+>/g, ' ');
  const decoded = decodeHtmlEntities(withoutTags);
  return decoded.replace(/\s+/g, ' ').trim();
}

export function resolvePublishedAt(parsed: Date | null, fetchedAt: Date): Date {
  return parsed ?? fetchedAt;
}

export function extractNormalizedFields(
  payload: Record<string, unknown>,
  feedLanguage = 'en',
): NormalizedPayloadFields {
  const rawTitle = typeof payload.title === 'string' ? payload.title : '';
  const cleanedTitle = cleanDisplayText(rawTitle);
  const title = cleanedTitle.length > 0 ? cleanedTitle : 'Untitled';

  const rawSummary =
    typeof payload.description === 'string' ? payload.description : '';
  const cleanedSummary = cleanDisplayText(rawSummary);
  const summary = cleanedSummary.length > 0 ? cleanedSummary : null;

  const link =
    typeof payload.link === 'string' ? payload.link.trim() : undefined;
  const guid = extractGuid(payload);
  const url = link ?? guid;

  if (!url || !isValidUrl(url)) {
    throw new Error('No usable URL for article normalization');
  }

  const publishedAt = parsePublishedAt(
    payload.pubDate ??
      payload.published ??
      payload.updated ??
      payload['dc:date'],
  );

  const language = feedLanguage.trim() || 'en';

  return {
    title,
    summary,
    url,
    language,
    languageConfidence: 1,
    publishedAt,
  };
}

export function extractGuid(
  payload: Record<string, unknown>,
): string | undefined {
  const guid = payload.guid;
  if (typeof guid === 'string') {
    const trimmed = guid.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (guid && typeof guid === 'object' && 'value' in guid) {
    const value = (guid as { value?: unknown }).value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
  }
  return undefined;
}

export function parsePublishedAt(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (value && typeof value === 'object' && 'value' in value) {
    return parsePublishedAt((value as { value?: unknown }).value);
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isNaN(code) ? '' : String.fromCodePoint(code);
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number(dec);
      return Number.isNaN(code) ? '' : String.fromCodePoint(code);
    });
}
