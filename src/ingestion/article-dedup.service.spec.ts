import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleDedupService } from './article-dedup.service';

describe('ArticleDedupService', () => {
  let service: ArticleDedupService;

  const publishedAt = new Date('2024-01-02T12:00:00Z');
  const createdAt = new Date('2024-01-02T12:05:00Z');

  const contentItem = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  };

  const prisma = {
    contentItem,
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    contentItem.update.mockResolvedValue({});

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
      canonicalContentId: null,
      article: { source: { trustTier: 2 } },
    };
    const existing = {
      id: 'hindu-1',
      title: 'PM visits Delhi after floods - The Hindu',
      titleFingerprint: 'after delhi floods pm visits',
      language: 'en',
      publishedAt,
      createdAt: new Date('2024-01-02T11:00:00Z'),
      canonicalContentId: null,
      article: { source: { trustTier: 1 } },
    };

    contentItem.findUnique.mockResolvedValue(incoming);
    contentItem.findMany.mockResolvedValueOnce([existing]);

    await service.linkAfterCreate('ani-1');

    expect(contentItem.update).toHaveBeenCalledWith({
      where: { id: 'hindu-1' },
      data: { canonicalContentId: null },
    });
    expect(contentItem.update).toHaveBeenCalledWith({
      where: { id: 'ani-1' },
      data: { canonicalContentId: 'hindu-1' },
    });
  });

  it('does not link unrelated titles', async () => {
    contentItem.findUnique.mockResolvedValue({
      id: 'a',
      title: 'Metro disruption in Dwarka',
      titleFingerprint: 'disruption dwarka metro',
      language: 'en',
      publishedAt,
      createdAt,
      canonicalContentId: null,
      article: { source: { trustTier: 2 } },
    });
    contentItem.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'b',
        title: 'Budget session begins in Parliament',
        titleFingerprint: 'begins budget parliament session',
        language: 'en',
        publishedAt,
        createdAt,
        canonicalContentId: null,
        article: { source: { trustTier: 2 } },
      },
    ]);

    await service.linkAfterCreate('a');

    expect(contentItem.update).not.toHaveBeenCalled();
  });
});
