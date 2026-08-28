import { Test, TestingModule } from '@nestjs/testing';
import { IngestionService } from './ingestion.service';
import { PrismaService } from '../prisma/prisma.service';
import { SourcesService } from '../sources/sources.service';
import { FetcherRegistry } from './fetchers/fetcher.registry';
import { NormalizationService } from './normalization.service';

const anyDate: unknown = expect.any(Date);

describe('IngestionService deduplication', () => {
  let service: IngestionService;

  const source = {
    id: 'source-1',
    slug: 'test-source',
    isActive: true,
    feeds: [
      {
        id: 'feed-1',
        url: 'https://example.com/feed.rss',
        isActive: true,
      },
    ],
  };

  const prisma = {
    rawArticle: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    sourceFeed: {
      update: jest.fn(),
    },
  };

  const fetcher = {
    fetch: jest.fn().mockResolvedValue([
      {
        externalId: 'ext-1',
        payload: { title: 'T', link: 'https://example.com/a' },
      },
    ]),
  };

  const normalizationService = {
    normalizeUnprocessedForSource: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma.rawArticle.findUnique.mockResolvedValue({ id: 'existing' });
    prisma.sourceFeed.update.mockResolvedValue(source.feeds[0]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: SourcesService,
          useValue: {
            findById: jest.fn().mockResolvedValue(source),
          },
        },
        {
          provide: FetcherRegistry,
          useValue: { getFetcherForSource: () => fetcher },
        },
        {
          provide: NormalizationService,
          useValue: normalizationService,
        },
      ],
    }).compile();

    service = module.get(IngestionService);
  });

  it('does not create duplicate raw articles', async () => {
    const result = await service.ingestSource('source-1');

    expect(result.newRawArticles).toBe(0);
    expect(prisma.rawArticle.create).not.toHaveBeenCalled();
  });

  it('creates raw article when not existing', async () => {
    prisma.rawArticle.findUnique.mockResolvedValue(null);
    prisma.rawArticle.create.mockResolvedValue({ id: 'raw-1' });

    const result = await service.ingestSource('source-1');

    expect(result.newRawArticles).toBe(1);
    expect(prisma.rawArticle.create).toHaveBeenCalledWith({
      data: {
        sourceFeedId: 'feed-1',
        externalId: 'ext-1',
        payload: { title: 'T', link: 'https://example.com/a' },
      },
    });
  });

  it('marks successful feed with ok status and clears errors', async () => {
    prisma.rawArticle.findUnique.mockResolvedValue(null);
    prisma.rawArticle.create.mockResolvedValue({ id: 'raw-1' });

    await service.ingestSource('source-1');

    expect(prisma.sourceFeed.update).toHaveBeenCalledWith({
      where: { id: 'feed-1' },
      data: {
        lastFetchedAt: anyDate,
        lastError: null,
        consecutiveFailures: 0,
        lastStatus: 'ok',
      },
    });
  });
});

describe('IngestionService feed isolation', () => {
  let service: IngestionService;

  const multiFeedSource = {
    id: 'source-1',
    slug: 'test-source',
    isActive: true,
    feeds: [
      {
        id: 'feed-ok',
        url: 'https://example.com/ok.rss',
        isActive: true,
      },
      {
        id: 'feed-bad',
        url: 'https://example.com/bad.rss',
        isActive: true,
      },
    ],
  };

  const prisma = {
    rawArticle: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    sourceFeed: {
      update: jest.fn(),
    },
  };

  const fetcher = {
    fetch: jest.fn(),
  };

  const normalizationService = {
    normalizeUnprocessedForSource: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    fetcher.fetch.mockImplementation((url: string) => {
      if (url.includes('bad')) {
        return Promise.reject(new Error('Feed fetch failed: 404'));
      }
      return Promise.resolve([
        {
          externalId: 'ext-ok',
          payload: { title: 'OK', link: 'https://example.com/ok-article' },
        },
      ]);
    });

    prisma.rawArticle.findUnique.mockResolvedValue(null);
    prisma.rawArticle.create.mockResolvedValue({ id: 'raw-1' });
    prisma.sourceFeed.update.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: SourcesService,
          useValue: {
            findById: jest.fn().mockResolvedValue(multiFeedSource),
          },
        },
        {
          provide: FetcherRegistry,
          useValue: { getFetcherForSource: () => fetcher },
        },
        {
          provide: NormalizationService,
          useValue: normalizationService,
        },
      ],
    }).compile();

    service = module.get(IngestionService);
  });

  it('continues ingesting other feeds when one feed fails', async () => {
    const result = await service.ingestSource('source-1');

    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
    expect(prisma.rawArticle.create).toHaveBeenCalledTimes(1);
    expect(result.newRawArticles).toBe(1);
  });

  it('records lastError on failed feed and ok status on successful feed', async () => {
    await service.ingestSource('source-1');

    expect(prisma.sourceFeed.update).toHaveBeenCalledWith({
      where: { id: 'feed-ok' },
      data: {
        lastFetchedAt: anyDate,
        lastError: null,
        consecutiveFailures: 0,
        lastStatus: 'ok',
      },
    });
    expect(prisma.sourceFeed.update).toHaveBeenCalledWith({
      where: { id: 'feed-bad' },
      data: {
        lastError: 'Feed fetch failed: 404',
        consecutiveFailures: { increment: 1 },
        lastStatus: 'error',
      },
    });
  });

  it('normalizes even when some feeds fail', async () => {
    await service.ingestSource('source-1');

    expect(
      normalizationService.normalizeUnprocessedForSource,
    ).toHaveBeenCalledWith('source-1');
  });
});
