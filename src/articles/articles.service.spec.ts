import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ArticlesService', () => {
  let service: ArticlesService;
  const prisma = {
    article: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ArticlesService);
  });

  it('returns paginated articles', async () => {
    const article = {
      id: 'a1',
      title: 'Title',
      summary: 'Summary',
      url: 'https://example.com',
      imageUrl: null,
      language: 'en',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      sourceId: 's1',
      createdAt: new Date(),
      source: { name: 'Source', type: 'NEWS' },
    };

    prisma.$transaction.mockResolvedValue([ [article], 1 ]);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(1);
  });

  it('throws NotFoundException for missing article', async () => {
    prisma.article.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
