import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleQueryDto } from './dto/article-query.dto';
import {
  ArticleDetailDto,
  ArticleListItemDto,
  ArticleListResponseDto,
} from './dto/article-response.dto';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ArticleQueryDto): Promise<ArticleListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ArticleWhereInput = {};
    if (query.sourceId) {
      where.sourceId = query.sourceId;
    }

    const [articles, total] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          source: {
            select: { name: true, type: true },
          },
        },
      }),
      this.prisma.article.count({ where }),
    ]);

    const items: ArticleListItemDto[] = articles.map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      url: article.url,
      imageUrl: article.imageUrl,
      language: article.language,
      publishedAt: article.publishedAt,
      fetchedAt: article.fetchedAt,
      sourceId: article.sourceId,
      createdAt: article.createdAt,
      source: {
        name: article.source.name,
        type: article.source.type,
      },
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  async findById(id: string): Promise<ArticleDetailDto> {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        source: {
          select: { name: true, type: true },
        },
        rawArticle: {
          select: {
            id: true,
            externalId: true,
            payload: true,
            fetchedAt: true,
            processed: true,
          },
        },
      },
    });

    if (!article) {
      throw new NotFoundException(`Article with id ${id} not found`);
    }

    return {
      id: article.id,
      rawArticleId: article.rawArticleId,
      title: article.title,
      summary: article.summary,
      url: article.url,
      imageUrl: article.imageUrl,
      language: article.language,
      publishedAt: article.publishedAt,
      fetchedAt: article.fetchedAt,
      sourceId: article.sourceId,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      source: {
        name: article.source.name,
        type: article.source.type,
      },
      rawArticle: {
        id: article.rawArticle.id,
        externalId: article.rawArticle.externalId,
        payload: article.rawArticle.payload as Record<string, unknown>,
        fetchedAt: article.rawArticle.fetchedAt,
        processed: article.rawArticle.processed,
      },
    };
  }
}
