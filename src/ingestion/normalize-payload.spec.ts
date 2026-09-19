import {
  cleanDisplayText,
  extractImageUrlFromHtml,
  extractNormalizedFields,
  parsePublishedAt,
  resolvePublishedAt,
} from './normalize-payload';

describe('extractImageUrlFromHtml', () => {
  const indiaTodayDescription =
    '<a href="https://www.indiatoday.in/business/story/example">' +
    '<img align="left" height="180" width="305" src="https://akm-img-a-in.tosshub.com/indiatoday/images/story/202609/example.png">' +
    '</a> Tata Sons board approves reappointment';

  it('extracts image URL from img src in HTML description', () => {
    expect(extractImageUrlFromHtml(indiaTodayDescription)).toBe(
      'https://akm-img-a-in.tosshub.com/indiatoday/images/story/202609/example.png',
    );
  });

  it('returns null when HTML has no image', () => {
    expect(extractImageUrlFromHtml('<p>Plain text only</p>')).toBeNull();
  });

  it('returns null for relative image src', () => {
    expect(extractImageUrlFromHtml('<img src="/images/photo.jpg">')).toBeNull();
  });

  it('returns null for data URI image src', () => {
    expect(
      extractImageUrlFromHtml('<img src="data:image/png;base64,iVBORw0KGgo=">'),
    ).toBeNull();
  });
});

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
