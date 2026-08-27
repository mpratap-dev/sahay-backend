import { Injectable, Logger } from '@nestjs/common';
import { ArticleTopicSource } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleDedupService } from './article-dedup.service';
import {
  extractNormalizedFields,
  isValidUrl,
  resolvePublishedAt,
  type NormalizedPayloadFields,
} from './normalize-payload';
import { titleFingerprint } from './title-fingerprint';
import { topicSlugsFromRawCategoryLabel } from './topic-mapping';

export interface NormalizedArticleData extends NormalizedPayloadFields {
  imageUrl: string | null;
}

export const NORMALIZE_BATCH_SIZE = 500;

@Injectable()
export class NormalizationService {
  private readonly logger = new Logger(NormalizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly articleDedupService: ArticleDedupService,
  ) {}

  async normalizeUnprocessedForSource(
    sourceId: string,
    take = NORMALIZE_BATCH_SIZE,
  ): Promise<number> {
    const unprocessed = await this.prisma.rawArticle.findMany({
      where: { processed: false, sourceFeed: { sourceId } },
      orderBy: { fetchedAt: 'asc' },
      take,
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
      include: { sourceFeed: true },
    });

    if (!rawArticle || rawArticle.processed) {
      return false;
    }

    const payload = rawArticle.payload as Record<string, unknown>;

    try {
      const feedLanguage = rawArticle.sourceFeed.language || 'en';
      const normalized = this.normalizePayload(payload, feedLanguage);
      const fingerprint = titleFingerprint(normalized.title);
      const publishedAt = resolvePublishedAt(
        normalized.publishedAt,
        rawArticle.fetchedAt,
      );
      const topicSlugs = topicSlugsFromRawCategoryLabel(
        rawArticle.sourceFeed.rawCategoryLabel,
      );

      const createdContentItemId = await this.prisma.$transaction(
        async (tx) => {
          let newId: string | null = null;
          const existingArticle = await tx.article.findUnique({
            where: { rawArticleId: rawArticle.id },
          });

          if (!existingArticle) {
            const topics =
              topicSlugs.length > 0
                ? await tx.topic.findMany({
                    where: { slug: { in: topicSlugs } },
                    select: { id: true },
                  })
                : [];

            const created = await tx.contentItem.create({
              data: {
                type: 'NEWS_ARTICLE',
                title: normalized.title,
                summary: normalized.summary,
                language: normalized.language,
                languageConfidence: normalized.languageConfidence,
                publishedAt,
                titleFingerprint: fingerprint,
                categoryId: rawArticle.sourceFeed.categoryId,
                article: {
                  create: {
                    rawArticleId: rawArticle.id,
                    sourceId: rawArticle.sourceFeed.sourceId,
                    url: normalized.url,
                    imageUrl: normalized.imageUrl,
                    fetchedAt: rawArticle.fetchedAt,
                    articleTopics:
                      topics.length > 0
                        ? {
                            create: topics.map((topic) => ({
                              topicId: topic.id,
                              source: ArticleTopicSource.FEED_CATEGORY,
                              confidence: 1,
                            })),
                          }
                        : undefined,
                  },
                },
              },
            });
            newId = created.id;
          }

          await tx.rawArticle.update({
            where: { id: rawArticle.id },
            data: {
              processed: true,
              processedAt: new Date(),
              processingError: null,
            },
          });

          return newId;
        },
      );

      if (createdContentItemId) {
        await this.articleDedupService.linkAfterCreate(createdContentItemId);
      }

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.prisma.rawArticle.update({
        where: { id: rawArticleId },
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
          if (isValidUrl(imageUrl)) {
            return imageUrl;
          }
        }
      }
    }
    return null;
  }

  private extractImageUrl(payload: Record<string, unknown>): string | null {
    const enclosure = payload.enclosure as Record<string, unknown> | undefined;
    if (enclosure && typeof enclosure.url === 'string') {
      const type = enclosure.type as string | undefined;
      if (!type || type.startsWith('image/')) {
        const url = enclosure.url.trim();
        if (isValidUrl(url)) return url;
      }
    }

    const mediaContent = payload['media:content'] as
      Record<string, unknown> | Record<string, unknown>[] | undefined;

    if (Array.isArray(mediaContent)) {
      for (const media of mediaContent) {
        const url = this.imageUrlFromMedia(media);
        if (url) return url;
      }
    } else if (mediaContent) {
      const url = this.imageUrlFromMedia(mediaContent);
      if (url) return url;
    }

    const mediaThumbnail = payload['media:thumbnail'] as
      Record<string, unknown> | Record<string, unknown>[] | undefined;

    if (Array.isArray(mediaThumbnail)) {
      for (const thumb of mediaThumbnail) {
        if (typeof thumb.url === 'string') {
          const url = thumb.url.trim();
          if (isValidUrl(url)) return url;
        }
      }
    } else if (mediaThumbnail && typeof mediaThumbnail.url === 'string') {
      const url = mediaThumbnail.url.trim();
      if (isValidUrl(url)) return url;
    }

    return null;
  }

  private imageUrlFromMedia(media: Record<string, unknown>): string | null {
    if (typeof media.url !== 'string') return null;
    const type = media.type as string | undefined;
    const medium = media.medium as string | undefined;
    if (medium === 'image' || (type && type.startsWith('image/')) || !type) {
      const url = media.url.trim();
      if (isValidUrl(url)) return url;
    }
    return null;
  }

  normalizePayload(
    payload: Record<string, unknown>,
    feedLanguage = 'en',
  ): NormalizedArticleData {
    const fields = extractNormalizedFields(payload, feedLanguage);
    const imageUrl = this.extractImageUrl(payload) ?? this.getImageUrl(payload);

    return {
      ...fields,
      imageUrl,
    };
  }
}
