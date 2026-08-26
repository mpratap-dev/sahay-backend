import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleDedupService } from './article-dedup.service';

describe('ArticleDedupService', () => {
  let service: ArticleDedupService;

  const publishedAt = new Date('2024-01-02T12:00:00Z');
  const createdAt = new Date('2024-01-02T12:05:00Z');

  const article = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  };

  const prisma = {
    article,
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    article.update.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleDedupService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ArticleDedupService);
  });

  it('links a later match to the lower-trustTier canonical', async () => {
    const incoming = {
      id: 'ani-1',
      title: 'PM visits Delhi after floods | ANI',
      titleFingerprint: 'after delhi floods pm visits',
      language: 'en',
      publishedAt,
      createdAt,
      canonicalArticleId: null,
      source: { trustTier: 2 },
    };
    const existing = {
      id: 'hindu-1',
      title: 'PM visits Delhi after floods - The Hindu',
      titleFingerprint: 'after delhi floods pm visits',
      language: 'en',
      publishedAt,
      createdAt: new Date('2024-01-02T11:00:00Z'),
      canonicalArticleId: null,
      source: { trustTier: 1 },
    };

    article.findUnique.mockResolvedValue(incoming);
    article.findMany.mockResolvedValueOnce([existing]);

    await service.linkAfterCreate('ani-1');

    expect(article.update).toHaveBeenCalledWith({
      where: { id: 'hindu-1' },
      data: { canonicalArticleId: null },
    });
    expect(article.update).toHaveBeenCalledWith({
      where: { id: 'ani-1' },
      data: { canonicalArticleId: 'hindu-1' },
    });
  });

  it('does not link unrelated titles', async () => {
    article.findUnique.mockResolvedValue({
      id: 'a',
      title: 'Metro disruption in Dwarka',
      titleFingerprint: 'disruption dwarka metro',
      language: 'en',
      publishedAt,
      createdAt,
      canonicalArticleId: null,
      source: { trustTier: 2 },
    });
    article.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'b',
        title: 'Budget session begins in Parliament',
        titleFingerprint: 'begins budget parliament session',
        language: 'en',
        publishedAt,
        createdAt,
        canonicalArticleId: null,
        source: { trustTier: 2 },
      },
    ]);

    await service.linkAfterCreate('a');

    expect(article.update).not.toHaveBeenCalled();
  });
});
