const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'but',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'were',
  'with',
]);

const PUBLISHER_SUFFIX =
  /\s*[-–—|:]\s*(the hindu|ani|press trust of india|pti)\s*$/i;

export function titleTokens(title: string): string[] {
  const withoutSuffix = title.replace(PUBLISHER_SUFFIX, '');
  const normalized = withoutSuffix
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return [];
  }

  const unique = new Set<string>();
  for (const token of normalized.split(' ')) {
    if (token.length > 0 && !STOPWORDS.has(token)) {
      unique.add(token);
    }
  }
  return [...unique];
}

export function titleFingerprint(title: string): string | null {
  const tokens = titleTokens(title);
  if (tokens.length === 0) {
    return null;
  }
  return [...tokens].sort().join(' ');
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export type CanonicalCandidate = {
  id: string;
  publishedAt: Date;
  createdAt: Date;
  trustTier: number;
};

export function pickCanonical<T extends CanonicalCandidate>(articles: T[]): T {
  if (articles.length === 0) {
    throw new Error('Cannot pick canonical from empty cluster');
  }

  return [...articles].sort((left, right) => {
    if (left.trustTier !== right.trustTier) {
      return left.trustTier - right.trustTier;
    }
    const publishedDiff =
      left.publishedAt.getTime() - right.publishedAt.getTime();
    if (publishedDiff !== 0) {
      return publishedDiff;
    }
    return left.createdAt.getTime() - right.createdAt.getTime();
  })[0];
}
