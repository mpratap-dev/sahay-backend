import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SourcesService } from '../sources/sources.service';
import { FetcherRegistry } from './fetchers/fetcher.registry';
import { NormalizationService } from './normalization.service';

export interface IngestionResult {
  sourceId: string;
  itemsFetched: number;
  newRawArticles: number;
  articlesNormalized: number;
  durationMs: number;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sourcesService: SourcesService,
    private readonly fetcherRegistry: FetcherRegistry,
    private readonly normalizationService: NormalizationService,
  ) {}

  async ingestSource(sourceId: string): Promise<IngestionResult> {
    const start = Date.now();
    const source = await this.sourcesService.findById(sourceId);

    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    if (!source.isActive) {
      throw new Error(`Source is not active: ${sourceId}`);
    }

    const fetcher = this.fetcherRegistry.getFetcherForSource();
    const items = await fetcher.fetch(source.feedUrl);

    let newRawArticles = 0;

    for (const item of items) {
      const existing = await this.prisma.rawArticle.findUnique({
        where: {
          sourceId_externalId: {
            sourceId: source.id,
            externalId: item.externalId,
          },
        },
      });

      if (!existing) {
        await this.prisma.rawArticle.create({
          data: {
            sourceId: source.id,
            externalId: item.externalId,
            payload: item.payload as Prisma.InputJsonValue,
          },
        });
        newRawArticles++;
      }
    }

    await this.prisma.source.update({
      where: { id: source.id },
      data: { lastFetchedAt: new Date() },
    });

    const articlesNormalized =
      await this.normalizationService.normalizeUnprocessedForSource(source.id);

    const durationMs = Date.now() - start;

    this.logger.log({
      msg: 'Ingestion completed',
      sourceId: source.id,
      sourceSlug: source.slug,
      itemsFetched: items.length,
      newRawArticles,
      articlesNormalized,
      durationMs,
    });

    return {
      sourceId: source.id,
      itemsFetched: items.length,
      newRawArticles,
      articlesNormalized,
      durationMs,
    };
  }
}
