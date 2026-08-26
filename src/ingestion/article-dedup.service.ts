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

  async linkAfterCreate(contentItemId: string): Promise<void> {
    const contentItem = await this.prisma.contentItem.findUnique({
      where: { id: contentItemId },
      include: { article: { include: { source: { select: { trustTier: true } } } } },
    });

    if (!contentItem?.titleFingerprint || !contentItem.publishedAt) {
      return;
    }

    const windowStart = new Date(
      contentItem.publishedAt.getTime() - DEDUP_WINDOW_MS,
    );
    const windowEnd = new Date(
      contentItem.publishedAt.getTime() + DEDUP_WINDOW_MS,
    );

    const fingerprintMatches = await this.prisma.contentItem.findMany({
      where: {
        id: { not: contentItem.id },
        language: contentItem.language,
        titleFingerprint: contentItem.titleFingerprint,
        publishedAt: { gte: windowStart, lte: windowEnd },
      },
      include: { article: { include: { source: { select: { trustTier: true } } } } },
    });

    let matches = fingerprintMatches;

    if (matches.length === 0) {
      const recent = await this.prisma.contentItem.findMany({
        where: {
          id: { not: contentItem.id },
          language: contentItem.language,
          titleFingerprint: { not: null },
          publishedAt: { gte: windowStart, lte: windowEnd },
        },
        take: DEDUP_SCAN_LIMIT,
        orderBy: { publishedAt: 'desc' },
        include: { article: { include: { source: { select: { trustTier: true } } } } },
      });

      const tokens = titleTokens(contentItem.title);
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
          .map((match) => match.canonicalContentId)
          .filter((id): id is string => Boolean(id) && id !== contentItem.id),
      ),
    ];

    const extras =
      extraIds.length > 0
        ? await this.prisma.contentItem.findMany({
            where: { id: { in: extraIds } },
            include: { article: { include: { source: { select: { trustTier: true } } } } },
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
      title: string;
      publishedAt: Date | null;
      createdAt: Date;
      article: { source: { trustTier: number } } | null;
    }) => {
      if (!row.publishedAt) {
        return;
      }
      clusterById.set(row.id, {
        id: row.id,
        publishedAt: row.publishedAt,
        createdAt: row.createdAt,
        trustTier: row.article?.source.trustTier ?? 2,
      });
    };

    addToCluster({ ...contentItem, article: contentItem.article ?? null });
    for (const match of matches) {
      addToCluster({ ...match, article: match.article ?? null });
    }
    for (const extra of extras) {
      addToCluster({ ...extra, article: extra.article ?? null });
    }

    const cluster = [...clusterById.values()];
    if (cluster.length < 2) {
      return;
    }

    const winner = pickCanonical(cluster);

    await this.prisma.$transaction(
      cluster.map((member) =>
        this.prisma.contentItem.update({
          where: { id: member.id },
          data: {
            canonicalContentId: member.id === winner.id ? null : winner.id,
          },
        }),
      ),
    );
  }
}
