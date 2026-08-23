import { Test, TestingModule } from '@nestjs/testing';
import { IngestionService } from './ingestion.service';
import { PrismaService } from '../prisma/prisma.service';
import { SourcesService } from '../sources/sources.service';
import { FetcherRegistry } from './fetchers/fetcher.registry';
import { NormalizationService } from './normalization.service';

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
});
