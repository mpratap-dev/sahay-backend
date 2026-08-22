import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SourceSummaryDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;
}

export class ArticleListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  summary: string | null;

  @ApiProperty()
  url: string;

  @ApiPropertyOptional()
  imageUrl: string | null;

  @ApiProperty()
  language: string;

  @ApiPropertyOptional()
  publishedAt: Date | null;

  @ApiProperty()
  fetchedAt: Date;

  @ApiProperty()
  sourceId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: SourceSummaryDto })
  source: SourceSummaryDto;
}

export class ArticleListResponseDto {
  @ApiProperty({ type: [ArticleListItemDto] })
  items: ArticleListItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class RawArticleDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  externalId: string;

  @ApiProperty()
  payload: Record<string, unknown>;

  @ApiProperty()
  fetchedAt: Date;

  @ApiProperty()
  processed: boolean;
}

export class ArticleDetailDto extends ArticleListItemDto {
  @ApiProperty()
  rawArticleId: string;

  @ApiPropertyOptional()
  updatedAt: Date;

  @ApiPropertyOptional({ type: RawArticleDto })
  rawArticle?: RawArticleDto;
}
