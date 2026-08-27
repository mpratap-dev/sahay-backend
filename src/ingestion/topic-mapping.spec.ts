import { TOPIC_SEED, topicSlugsFromRawCategoryLabel } from './topic-mapping';

describe('topicSlugsFromRawCategoryLabel', () => {
  it('returns empty for missing label', () => {
    expect(topicSlugsFromRawCategoryLabel(null)).toEqual([]);
    expect(topicSlugsFromRawCategoryLabel(undefined)).toEqual([]);
    expect(topicSlugsFromRawCategoryLabel('')).toEqual([]);
  });

  it('maps ANI-style category paths', () => {
    expect(
      topicSlugsFromRawCategoryLabel('category/national/politics'),
    ).toEqual(expect.arrayContaining(['national', 'politics']));
    expect(topicSlugsFromRawCategoryLabel('category/sports/cricket')).toEqual(
      expect.arrayContaining(['sports']),
    );
    expect(topicSlugsFromRawCategoryLabel('category/tech/science')).toEqual(
      expect.arrayContaining(['technology', 'science']),
    );
  });

  it('maps The Hindu Delhi city desk', () => {
    expect(topicSlugsFromRawCategoryLabel('news/cities/Delhi')).toEqual(
      expect.arrayContaining(['delhi', 'national']),
    );
  });

  it('only returns seeded topic slugs', () => {
    const slugs = topicSlugsFromRawCategoryLabel('category/business');
    const known = new Set(TOPIC_SEED.map((t) => t.slug));
    for (const slug of slugs) {
      expect(known.has(slug)).toBe(true);
    }
  });
});
