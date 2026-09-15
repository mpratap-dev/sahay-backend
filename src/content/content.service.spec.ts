import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { ContentStatus, ContentType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ContentService } from './content.service';
import { encodeCursor } from './cursor';

describe('ContentService', () => {
  let service: ContentService;

  const contentItem = {
    findMany: jest.fn(),
  };

  const newsCategory = {
    findMany: jest.fn(),
  };

  const prisma = {
    contentItem,
    newsCategory,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    newsCategory.findMany.mockResolvedValue([{ id: 'cat-1', slug: 'delhi' }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ContentService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ContentService);
  });

  it('returns published content with cursor pagination metadata', async () => {
    const publishedAt = new Date('2024-01-02T12:00:00Z');
    contentItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        type: ContentType.NEWS_ARTICLE,
        status: ContentStatus.PUBLISHED,
        title: 'Title',
        summary: 'Summary',
        publishedAt,
        category: { id: 'cat-1', name: 'Delhi', slug: 'delhi' },
        article: {
          url: 'https://example.com',
          imageUrl: null,
          source: { name: 'Source', slug: 'source', trustTier: 1 },
        },
      },
    ]);

    const result = await service.findAll({ limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].article?.source.trustTier).toBe(1);
    expect(result.nextCursor).toBeNull();
    expect(contentItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ContentStatus.PUBLISHED,
          canonicalContentId: null,
        }) as Prisma.ContentItemWhereInput,
        take: 21,
      }),
    );
  });

  it('returns nextCursor when more rows exist', async () => {
    const publishedAt = new Date('2024-01-02T12:00:00Z');
    contentItem.findMany.mockResolvedValue([
      {
        id: 'item-2',
        type: ContentType.NEWS_ARTICLE,
        status: ContentStatus.PUBLISHED,
        title: 'Second',
        summary: null,
        publishedAt,
        category: null,
        article: {
          url: 'https://example.com/2',
          imageUrl: null,
          source: { name: 'Source', slug: 'source', trustTier: 2 },
        },
      },
      {
        id: 'item-1',
        type: ContentType.NEWS_ARTICLE,
        status: ContentStatus.PUBLISHED,
        title: 'First',
        summary: null,
        publishedAt,
        category: null,
        article: {
          url: 'https://example.com/1',
          imageUrl: null,
          source: { name: 'Source', slug: 'source', trustTier: 2 },
        },
      },
    ]);

    const result = await service.findAll({ limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe(encodeCursor({ publishedAt, id: 'item-2' }));
  });

  it('rejects invalid cursors', async () => {
    await expect(
      service.findAll({ cursor: 'not-a-cursor' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown categories', async () => {
    await expect(
      service.findAll({ category: ['missing'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
