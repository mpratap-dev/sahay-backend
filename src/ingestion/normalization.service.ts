import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface NormalizedArticleData {
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  language: string;
  publishedAt: Date | null;
}

@Injectable()
export class NormalizationService {
  private readonly logger = new Logger(NormalizationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async normalizeUnprocessedForSource(sourceId: string): Promise<number> {
    const unprocessed = await this.prisma.rawArticle.findMany({
      where: { sourceId, processed: false },
    });

    let normalized = 0;

    for (const rawArticle of unprocessed) {
      try {
        const didNormalize = await this.normalizeRawArticle(rawArticle.id);
        if (didNormalize) normalized++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn({
          msg: 'Normalization failed for raw article',
          rawArticleId: rawArticle.id,
          error: message,
        });
      }
    }

    return normalized;
  }

  async normalizeRawArticle(rawArticleId: string): Promise<boolean> {
    const rawArticle = await this.prisma.rawArticle.findUnique({
      where: { id: rawArticleId },
    });

    if (!rawArticle || rawArticle.processed) {
      return false;
    }

    const payload = rawArticle.payload as Record<string, unknown>;

    try {
      const normalized = this.normalizePayload(payload);

      await this.prisma.$transaction(async (tx) => {
        const existingArticle = await tx.article.findUnique({
          where: { rawArticleId: rawArticle.id },
        });

        if (!existingArticle) {
          await tx.article.create({
            data: {
              rawArticleId: rawArticle.id,
              sourceId: rawArticle.sourceId,
              title: normalized.title,
              summary: normalized.summary,
              url: normalized.url,
              imageUrl: normalized.imageUrl,
              language: normalized.language,
              publishedAt: normalized.publishedAt,
              fetchedAt: rawArticle.fetchedAt,
            },
          });
        }

        await tx.rawArticle.update({
          where: { id: rawArticle.id },
          data: {
            processed: true,
            processedAt: new Date(),
            processingError: null,
          },
        });
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.prisma.rawArticle.update({
        where: { id: rawArticle.id },
        data: {
          processed: false,
          processingError: message,
        },
      });

      throw error;
    }
  }

  getImageUrl(payload: Record<string, unknown>): string | null {
    const media = payload.media as
      { contents: { url: string; medium: string }[] } | undefined;
    if (media && media.contents.length > 0) {
      for (const content of media.contents) {
        if (content.medium === 'image') {
          const imageUrl = content.url.trim();
          if (this.isValidUrl(imageUrl)) {
            return imageUrl;
          }
        }
      }
    }
    return null;
  }

  normalizePayload(payload: Record<string, unknown>): NormalizedArticleData {
    const title =
      typeof payload.title === 'string' && payload.title.trim()
        ? payload.title.trim()
        : 'Untitled';

    const summary =
      typeof payload.description === 'string'
        ? payload.description.trim() || null
        : null;

    const link =
      typeof payload.link === 'string' ? payload.link.trim() : undefined;
    const guid = this.extractGuid(payload);
    const url = link ?? guid;

    if (!url || !this.isValidUrl(url)) {
      throw new Error('No usable URL for article normalization');
    }

    const imageUrl = this.getImageUrl(payload);

    const publishedAt = this.parsePublishedAt(
      payload.pubDate ?? payload.published ?? payload.updated,
    );

    return {
      title,
      summary,
      url,
      imageUrl,
      language: 'en',
      publishedAt,
    };
  }

  private extractGuid(payload: Record<string, unknown>): string | undefined {
    const guid = payload.guid;
    if (typeof guid === 'string') {
      const trimmed = guid.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (guid && typeof guid === 'object' && 'value' in guid) {
      const value = (guid as { value?: unknown }).value;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }
    }
    return undefined;
  }

  private parsePublishedAt(value: unknown): Date | null {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
