import { Test, TestingModule } from '@nestjs/testing';
import { ArticleDedupService } from './article-dedup.service';
import {
  NORMALIZE_BATCH_SIZE,
  NormalizationService,
} from './normalization.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NormalizationService', () => {
  let service: NormalizationService;
  let prisma: {
    rawArticle: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    article: { findUnique: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      rawArticle: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      article: { findUnique: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NormalizationService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: ArticleDedupService,
          useValue: { linkAfterCreate: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(NormalizationService);
  });

  it('extracts title from payload', () => {
    const result = service.normalizePayload({
      title: 'Test Title',
      link: 'https://example.com/a',
    });
    expect(result.title).toBe('Test Title');
  });

  it('uses Untitled fallback for missing title', () => {
    const result = service.normalizePayload({
      link: 'https://example.com/a',
    });
    expect(result.title).toBe('Untitled');
  });

  it('extracts summary from description', () => {
    const result = service.normalizePayload({
      title: 'T',
      link: 'https://example.com/a',
      description: 'Summary text',
    });
    expect(result.summary).toBe('Summary text');
  });

  it('extracts URL from link with guid fallback', () => {
    const fromLink = service.normalizePayload({
      title: 'T',
      link: 'https://example.com/from-link',
    });
    const fromGuid = service.normalizePayload({
      title: 'T',
      guid: 'https://example.com/from-guid',
    });
    expect(fromLink.url).toBe('https://example.com/from-link');
    expect(fromGuid.url).toBe('https://example.com/from-guid');
  });

  it('parses valid publication date', () => {
    const result = service.normalizePayload({
      title: 'T',
      link: 'https://example.com/a',
      pubDate: 'Mon, 01 Jan 2024 12:00:00 GMT',
    });
    expect(result.publishedAt).toBeInstanceOf(Date);
  });

  it('returns null for invalid publication date', () => {
    const result = service.normalizePayload({
      title: 'T',
      link: 'https://example.com/a',
      pubDate: 'not-a-date',
    });
    expect(result.publishedAt).toBeNull();
  });

  it('fails normalization when URL is missing', () => {
    expect(() =>
      service.normalizePayload({
        title: 'T',
      }),
    ).toThrow('No usable URL for article normalization');
  });

  it('extracts imageUrl from enclosure onto Article, not payload', () => {
    const payload = {
      title: 'T',
      link: 'https://example.com/a',
      enclosure: {
        url: 'https://example.com/photo.jpg',
        type: 'image/jpeg',
      },
    };
    const result = service.normalizePayload(payload);
    expect(result.imageUrl).toBe('https://example.com/photo.jpg');
    expect(payload).not.toHaveProperty('imageUrl');
  });

  it('sets language and confidence from feed language', () => {
    const result = service.normalizePayload(
      {
        title: 'T',
        link: 'https://example.com/a',
      },
      'en',
    );
    expect(result.language).toBe('en');
    expect(result.languageConfidence).toBe(1);
  });

  it('limits normalizeUnprocessedForSource to a batch', async () => {
    await service.normalizeUnprocessedForSource('source-1');

    expect(prisma.rawArticle.findMany).toHaveBeenCalledWith({
      where: { processed: false, sourceFeed: { sourceId: 'source-1' } },
      orderBy: { fetchedAt: 'asc' },
      take: NORMALIZE_BATCH_SIZE,
    });
  });

  it('allows overriding the normalize batch size', async () => {
    await service.normalizeUnprocessedForSource('source-1', 100);

    expect(prisma.rawArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
