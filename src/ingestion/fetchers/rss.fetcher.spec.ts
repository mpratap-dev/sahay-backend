import { Test, TestingModule } from '@nestjs/testing';
import { RssFetcher } from './rss.fetcher';

const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article One</title>
      <link>https://example.com/article-one</link>
      <guid>guid-one</guid>
      <description>Summary one</description>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Article Two</title>
      <link>https://example.com/article-two</link>
      <description>Summary two</description>
      <pubDate>Mon, 02 Jan 2024 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title></title>
    </item>
  </channel>
</rss>`;

describe('RssFetcher', () => {
  let fetcher: RssFetcher;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RssFetcher],
    }).compile();

    fetcher = module.get(RssFetcher);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses RSS feed successfully', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      body: null,
      text: () => Promise.resolve(sampleRss),
    });

    const items = await fetcher.fetch('https://example.com/feed.rss');

    expect(items).toHaveLength(2);
    expect(items[0].externalId).toBe('guid-one');
    expect(items[0].payload.title).toBe('Article One');
    expect(items[1].externalId).toBe('https://example.com/article-two');
  });

  it('throws on HTTP failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
    });

    await expect(fetcher.fetch('https://example.com/feed.rss')).rejects.toThrow(
      'Feed fetch failed: 500',
    );
  });

  it('uses deterministic hash fallback for external ID', async () => {
    const rssWithoutGuid = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<item>
<title>Hash Article</title>
<link>https://example.com/hash-article</link>
<pubDate>Mon, 03 Jan 2024 12:00:00 GMT</pubDate>
</item>
</channel></rss>`;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      body: null,
      text: () => Promise.resolve(rssWithoutGuid),
    });

    const first = await fetcher.fetch('https://example.com/feed.rss');
    const second = await fetcher.fetch('https://example.com/feed.rss');

    expect(first[0].externalId).toBe('https://example.com/hash-article');
    expect(second[0].externalId).toBe(first[0].externalId);
  });

  it('skips items without stable identity', async () => {
    const rssOnlyBadItem = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<item><description>Only description</description></item>
</channel></rss>`;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      body: null,
      text: () => Promise.resolve(rssOnlyBadItem),
    });

    const items = await fetcher.fetch('https://example.com/feed.rss');
    expect(items).toHaveLength(0);
  });
});
