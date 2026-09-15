import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { ContentStatus, ContentType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { decodeCursor, encodeCursor } from './cursor';
import { ContentQueryDto, ContentSort } from './dto/content-query.dto';
import {
  ContentListItemDto,
  ContentListResponseDto,
} from './dto/content-response.dto';
import { ReferenceCache } from './reference-cache';

type ContentRow = Prisma.ContentItemGetPayload<{
  include: {
    category: true;
    article: { include: { source: true } };
  };
}>;

@Injectable()
export class ContentService {
  private readonly categoryCache = new ReferenceCache<
    Map<string, { id: string; slug: string }>
  >();

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ContentQueryDto): Promise<ContentListResponseDto> {
    const limit = query.limit ?? 20;
    const sort = query.sort ?? ContentSort.PUBLISHED_AT_DESC;
    const status = query.status ?? ContentStatus.PUBLISHED;
    const descending = sort === ContentSort.PUBLISHED_AT_DESC;

    let cursor: { publishedAt: Date; id: string } | null = null;
    if (query.cursor) {
      try {
        const decoded = decodeCursor(query.cursor);
        cursor = {
          publishedAt: new Date(decoded.publishedAt),
          id: decoded.id,
        };
      } catch {
        throw new BadRequestException('Invalid cursor');
      }
    }

    const categoryIds = await this.resolveCategoryIds(query.category);
    const types = query.type?.length ? query.type : undefined;
    const includeArticle = !types || types.includes(ContentType.NEWS_ARTICLE);

    const where: Prisma.ContentItemWhereInput = {
      status,
      canonicalContentId: null,
      ...(types && { type: { in: types } }),
      ...(query.language && { language: query.language }),
      ...(categoryIds && { categoryId: { in: categoryIds } }),
      ...(cursor && {
        OR: descending
          ? [
              { publishedAt: { lt: cursor.publishedAt } },
              { publishedAt: cursor.publishedAt, id: { lt: cursor.id } },
            ]
          : [
              { publishedAt: { gt: cursor.publishedAt } },
              { publishedAt: cursor.publishedAt, id: { gt: cursor.id } },
            ],
      }),
    };

    const items = await this.prisma.contentItem.findMany({
      where,
      orderBy: descending
        ? [{ publishedAt: 'desc' }, { id: 'desc' }]
        : [{ publishedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      select: {
        id: true,
        type: true,
        status: true,
        title: true,
        summary: true,
        publishedAt: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        ...(includeArticle && {
          article: {
            select: {
              url: true,
              imageUrl: true,
              source: {
                select: { name: true, slug: true, trustTier: true },
              },
            },
          },
        }),
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const last = page[page.length - 1];

    return {
      items: page.map((item) => this.toListItem(item as ContentRow)),
      nextCursor:
        hasMore && last.publishedAt
          ? encodeCursor({ publishedAt: last.publishedAt, id: last.id })
          : null,
    };
  }

  private toListItem(item: ContentRow): ContentListItemDto {
    const dto: ContentListItemDto = {
      id: item.id,
      type: item.type,
      status: item.status,
      title: item.title,
      summary: item.summary,
      publishedAt: item.publishedAt,
      category: item.category,
    };

    if (item.type === ContentType.NEWS_ARTICLE && item.article) {
      dto.article = {
        url: item.article.url,
        imageUrl: item.article.imageUrl,
        source: {
          name: item.article.source.name,
          slug: item.article.source.slug,
          trustTier: item.article.source.trustTier,
        },
      };
    }

    return dto;
  }

  private async resolveCategoryIds(
    categories: string[] | undefined,
  ): Promise<string[] | undefined> {
    if (!categories?.length) {
      return undefined;
    }

    const lookup = await this.getCategoryLookup();
    const ids = new Set<string>();

    for (const value of categories) {
      const byId = lookup.get(`id:${value}`);
      if (byId) {
        ids.add(byId.id);
        continue;
      }

      const bySlug = lookup.get(`slug:${value}`);
      if (bySlug) {
        ids.add(bySlug.id);
        continue;
      }

      throw new BadRequestException(`Unknown category: ${value}`);
    }

    return [...ids];
  }

  private async getCategoryLookup(): Promise<
    Map<string, { id: string; slug: string }>
  > {
    const cached = this.categoryCache.get();
    if (cached) {
      return cached;
    }

    const categories = await this.prisma.newsCategory.findMany({
      select: { id: true, slug: true },
    });

    const lookup = new Map<string, { id: string; slug: string }>();
    for (const category of categories) {
      lookup.set(`id:${category.id}`, category);
      lookup.set(`slug:${category.slug}`, category);
    }

    this.categoryCache.set(lookup);
    return lookup;
  }
}
