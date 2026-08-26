import {
  jaccardSimilarity,
  pickCanonical,
  titleFingerprint,
} from './title-fingerprint';

describe('titleFingerprint', () => {
  it('matches the same story after dropping publisher suffixes and stopwords', () => {
    const hindu = titleFingerprint(
      'PM visits Delhi after floods - The Hindu',
    );
    const ani = titleFingerprint('PM visits Delhi after floods | ANI');
    expect(hindu).toBe(ani);
    expect(hindu).toBeTruthy();
  });

  it('differs for unrelated titles', () => {
    expect(titleFingerprint('Metro disruption in Dwarka')).not.toBe(
      titleFingerprint('Budget session begins in Parliament'),
    );
  });
});

describe('jaccardSimilarity', () => {
  it('is high for near-identical wording', () => {
    const a =
      titleFingerprint(
        'Cabinet clears new metro corridor plan Delhi',
      )?.split(' ') ?? [];
    const b =
      titleFingerprint('Cabinet clears new metro corridor plan')?.split(' ') ??
      [];
    expect(jaccardSimilarity(a, b)).toBeGreaterThanOrEqual(0.85);
  });

  it('is low for unrelated titles', () => {
    const a = titleFingerprint('Metro disruption in Dwarka')?.split(' ') ?? [];
    const b =
      titleFingerprint('Budget session begins in Parliament')?.split(' ') ?? [];
    expect(jaccardSimilarity(a, b)).toBeLessThan(0.5);
  });
});

describe('pickCanonical', () => {
  const publishedAt = new Date('2024-01-01T10:00:00Z');
  const createdAt = new Date('2024-01-01T11:00:00Z');

  it('prefers lower trustTier', () => {
    const winner = pickCanonical([
      {
        id: 'news',
        publishedAt,
        createdAt,
        trustTier: 2,
      },
      {
        id: 'official',
        publishedAt,
        createdAt,
        trustTier: 1,
      },
    ]);
    expect(winner.id).toBe('official');
  });

  it('breaks ties with earlier publishedAt then createdAt', () => {
    const winner = pickCanonical([
      {
        id: 'later',
        publishedAt: new Date('2024-01-01T12:00:00Z'),
        createdAt: new Date('2024-01-01T09:00:00Z'),
        trustTier: 2,
      },
      {
        id: 'earlier',
        publishedAt: new Date('2024-01-01T10:00:00Z'),
        createdAt: new Date('2024-01-01T13:00:00Z'),
        trustTier: 2,
      },
    ]);
    expect(winner.id).toBe('earlier');
  });
});
