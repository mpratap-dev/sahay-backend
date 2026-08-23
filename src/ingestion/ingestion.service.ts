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
    const activeFeeds = source.feeds.filter((feed) => feed.isActive);

    let itemsFetched = 0;
    let newRawArticles = 0;

    for (const feed of activeFeeds) {
      const items = await fetcher.fetch(feed.url);
      itemsFetched += items.length;

      for (const item of items) {
        const existing = await this.prisma.rawArticle.findUnique({
          where: {
            sourceFeedId_externalId: {
              sourceFeedId: feed.id,
              externalId: item.externalId,
            },
          },
        });

        if (!existing) {
          await this.prisma.rawArticle.create({
            data: {
              sourceFeedId: feed.id,
              externalId: item.externalId,
              payload: item.payload as Prisma.InputJsonValue,
            },
          });
          newRawArticles++;
        }
      }

      await this.prisma.sourceFeed.update({
        where: { id: feed.id },
        data: { lastFetchedAt: new Date() },
      });
    }

    const articlesNormalized =
      await this.normalizationService.normalizeUnprocessedForSource(source.id);

    const durationMs = Date.now() - start;

    this.logger.log({
      msg: 'Ingestion completed',
      sourceId: source.id,
      sourceSlug: source.slug,
      itemsFetched,
      newRawArticles,
      articlesNormalized,
      durationMs,
    });

    return {
      sourceId: source.id,
      itemsFetched,
      newRawArticles,
      articlesNormalized,
      durationMs,
    };
  }
}
