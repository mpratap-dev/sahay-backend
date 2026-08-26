import {
  cleanDisplayText,
  extractNormalizedFields,
  parsePublishedAt,
  resolvePublishedAt,
} from './normalize-payload';

describe('cleanDisplayText', () => {
  it('strips HTML tags and collapses whitespace', () => {
    expect(cleanDisplayText('<p>Flood  <b>warning</b></p>')).toBe(
      'Flood warning',
    );
  });

  it('decodes HTML entities', () => {
    expect(cleanDisplayText('Delhi &amp; NCR &#8217;s rain')).toBe(
      'Delhi & NCR ’s rain',
    );
  });
});

describe('extractNormalizedFields', () => {
  it('cleans title and summary from HTML', () => {
    const result = extractNormalizedFields({
      title: '<p>Alert</p>',
      description: '<div>Water &amp; power</div>',
      link: 'https://example.com/a',
    });
    expect(result.title).toBe('Alert');
    expect(result.summary).toBe('Water & power');
  });

  it('uses Untitled when title is empty after cleanup', () => {
    const result = extractNormalizedFields({
      title: '<p>  </p>',
      link: 'https://example.com/a',
    });
    expect(result.title).toBe('Untitled');
  });

  it('parses dc:date when pubDate is missing', () => {
    const result = extractNormalizedFields({
      title: 'T',
      link: 'https://example.com/a',
      'dc:date': '2024-01-01T12:00:00Z',
    });
    expect(result.publishedAt).toBeInstanceOf(Date);
  });

  it('returns null publishedAt for invalid dates', () => {
    const result = extractNormalizedFields({
      title: 'T',
      link: 'https://example.com/a',
      pubDate: 'not-a-date',
    });
    expect(result.publishedAt).toBeNull();
  });
});

describe('resolvePublishedAt', () => {
  it('falls back to fetchedAt when parsed date is null', () => {
    const fetchedAt = new Date('2024-06-01T00:00:00Z');
    expect(resolvePublishedAt(null, fetchedAt)).toBe(fetchedAt);
  });
});

describe('parsePublishedAt', () => {
  it('reads nested dc:date value objects', () => {
    expect(
      parsePublishedAt({ value: 'Mon, 01 Jan 2024 12:00:00 GMT' }),
    ).toBeInstanceOf(Date);
  });
});
