/** Controlled SAHAY topics (English labels). Seeded into Topic rows. */
export const TOPIC_SEED: ReadonlyArray<{ slug: string; name: string }> = [
  { slug: 'delhi', name: 'Delhi' },
  { slug: 'national', name: 'National' },
  { slug: 'international', name: 'International' },
  { slug: 'politics', name: 'Politics' },
  { slug: 'elections', name: 'Elections' },
  { slug: 'government', name: 'Government' },
  { slug: 'municipal', name: 'Municipal' },
  { slug: 'traffic', name: 'Traffic' },
  { slug: 'roads', name: 'Roads' },
  { slug: 'metro', name: 'Metro' },
  { slug: 'transport', name: 'Transport' },
  { slug: 'water-supply', name: 'Water Supply' },
  { slug: 'electricity', name: 'Electricity' },
  { slug: 'air-quality', name: 'Air Quality' },
  { slug: 'environment', name: 'Environment' },
  { slug: 'waste-management', name: 'Waste Management' },
  { slug: 'weather', name: 'Weather' },
  { slug: 'disaster', name: 'Disaster' },
  { slug: 'health', name: 'Health' },
  { slug: 'education', name: 'Education' },
  { slug: 'housing', name: 'Housing' },
  { slug: 'employment', name: 'Employment' },
  { slug: 'crime', name: 'Crime' },
  { slug: 'public-safety', name: 'Public Safety' },
  { slug: 'judiciary', name: 'Judiciary' },
  { slug: 'infrastructure', name: 'Infrastructure' },
  { slug: 'business', name: 'Business' },
  { slug: 'economy', name: 'Economy' },
  { slug: 'agriculture', name: 'Agriculture' },
  { slug: 'technology', name: 'Technology' },
  { slug: 'science', name: 'Science' },
  { slug: 'sports', name: 'Sports' },
  { slug: 'entertainment', name: 'Entertainment' },
  { slug: 'culture', name: 'Culture' },
  { slug: 'opinion', name: 'Opinion' },
  { slug: 'food-safety', name: 'Food Safety' },
];

/** Map feed path / publisher section tokens → Topic.slug */
const SEGMENT_TO_TOPIC: Record<string, string> = {
  delhi: 'delhi',
  national: 'national',
  politics: 'politics',
  features: 'national',
  'general-news': 'national',
  business: 'business',
  'agri-business': 'agriculture',
  industry: 'business',
  economy: 'economy',
  markets: 'business',
  budget: 'economy',
  entertainment: 'entertainment',
  bollywood: 'entertainment',
  hollywood: 'entertainment',
  music: 'entertainment',
  movies: 'entertainment',
  art: 'culture',
  dance: 'culture',
  theatre: 'culture',
  sports: 'sports',
  sport: 'sports',
  cricket: 'sports',
  football: 'sports',
  tennis: 'sports',
  hockey: 'sports',
  athletics: 'sports',
  motorsport: 'sports',
  'other-sports': 'sports',
  world: 'international',
  international: 'international',
  asia: 'international',
  us: 'international',
  europe: 'international',
  pacific: 'international',
  'middle-east': 'international',
  health: 'health',
  tech: 'technology',
  mobile: 'technology',
  internet: 'technology',
  science: 'science',
  'sci-tech': 'science',
  news: 'national',
  states: 'national',
  opinion: 'opinion',
  editorial: 'opinion',
  columns: 'opinion',
  'op-ed': 'opinion',
  lead: 'opinion',
  'life-and-style': 'culture',
  fashion: 'culture',
  fitness: 'health',
  food: 'food-safety',
  travel: 'culture',
  weather: 'weather',
  education: 'education',
  elections: 'elections',
  government: 'government',
  municipal: 'municipal',
  traffic: 'traffic',
  roads: 'roads',
  metro: 'metro',
  transport: 'transport',
};

/**
 * Resolve Topic slugs from SourceFeed.rawCategoryLabel (URL path segments).
 * Returns unique slugs that exist in TOPIC_SEED.
 */
export function topicSlugsFromRawCategoryLabel(
  rawCategoryLabel: string | null | undefined,
): string[] {
  if (!rawCategoryLabel?.trim()) {
    return [];
  }

  const known = new Set(TOPIC_SEED.map((t) => t.slug));
  const segments = rawCategoryLabel
    .toLowerCase()
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

  const slugs = new Set<string>();

  for (const segment of segments) {
    const mapped = SEGMENT_TO_TOPIC[segment];
    if (mapped && known.has(mapped)) {
      slugs.add(mapped);
    }
  }

  // Explicit city desk: .../cities/Delhi/...
  if (segments.includes('cities') && segments.includes('delhi')) {
    slugs.add('delhi');
  }

  return [...slugs];
}
