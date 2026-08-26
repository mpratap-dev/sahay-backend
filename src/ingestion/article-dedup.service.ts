import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  jaccardSimilarity,
  pickCanonical,
  titleTokens,
} from './title-fingerprint';

export const DEDUP_WINDOW_MS = 48 * 60 * 60 * 1000;
export const DEDUP_JACCARD_THRESHOLD = 0.85;
export const DEDUP_SCAN_LIMIT = 200;

@Injectable()
export class ArticleDedupService {
  constructor(private readonly prisma: PrismaService) {}

  async linkAfterCreate(articleId: string): Promise<void> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: { source: { select: { trustTier: true } } },
    });

    if (!article?.titleFingerprint || !article.publishedAt) {
      return;
    }

    const windowStart = new Date(
      article.publishedAt.getTime() - DEDUP_WINDOW_MS,
    );
    const windowEnd = new Date(article.publishedAt.getTime() + DEDUP_WINDOW_MS);

    const fingerprintMatches = await this.prisma.article.findMany({
      where: {
        id: { not: article.id },
        language: article.language,
        titleFingerprint: article.titleFingerprint,
        publishedAt: { gte: windowStart, lte: windowEnd },
      },
      include: { source: { select: { trustTier: true } } },
    });

    let matches = fingerprintMatches;

    if (matches.length === 0) {
      const recent = await this.prisma.article.findMany({
        where: {
          id: { not: article.id },
          language: article.language,
          titleFingerprint: { not: null },
          publishedAt: { gte: windowStart, lte: windowEnd },
        },
        take: DEDUP_SCAN_LIMIT,
        orderBy: { publishedAt: 'desc' },
        include: { source: { select: { trustTier: true } } },
      });

      const tokens = titleTokens(article.title);
      matches = recent.filter(
        (candidate) =>
          jaccardSimilarity(tokens, titleTokens(candidate.title)) >=
          DEDUP_JACCARD_THRESHOLD,
      );
    }

    if (matches.length === 0) {
      return;
    }

    const extraIds = [
      ...new Set(
        matches
          .map((match) => match.canonicalArticleId)
          .filter((id): id is string => Boolean(id) && id !== article.id),
      ),
    ];

    const extras =
      extraIds.length > 0
        ? await this.prisma.article.findMany({
            where: { id: { in: extraIds } },
            include: { source: { select: { trustTier: true } } },
          })
        : [];

    const clusterById = new Map<
      string,
      {
        id: string;
        publishedAt: Date;
        createdAt: Date;
        trustTier: number;
      }
    >();

    const addToCluster = (row: {
      id: string;
      publishedAt: Date | null;
      createdAt: Date;
      source: { trustTier: number };
    }) => {
      if (!row.publishedAt) {
        return;
      }
      clusterById.set(row.id, {
        id: row.id,
        publishedAt: row.publishedAt,
        createdAt: row.createdAt,
        trustTier: row.source.trustTier,
      });
    };

    addToCluster(article);
    for (const match of matches) {
      addToCluster(match);
    }
    for (const extra of extras) {
      addToCluster(extra);
    }

    const cluster = [...clusterById.values()];
    if (cluster.length < 2) {
      return;
    }

    const winner = pickCanonical(cluster);

    await this.prisma.$transaction(
      cluster.map((member) =>
        this.prisma.article.update({
          where: { id: member.id },
          data: {
            canonicalArticleId: member.id === winner.id ? null : winner.id,
          },
        }),
      ),
    );
  }
}
