import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus, ContentType } from '../../generated/prisma/enums';

export class CategorySummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class SourceSummaryDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  trustTier!: number;
}

export class ArticleDetailDto {
  @ApiProperty()
  url!: string;

  @ApiPropertyOptional()
  imageUrl!: string | null;

  @ApiProperty({ type: SourceSummaryDto })
  source!: SourceSummaryDto;
}

export class ContentListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ContentType })
  type!: ContentType;

  @ApiProperty({ enum: ContentStatus })
  status!: ContentStatus;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  summary!: string | null;

  @ApiPropertyOptional()
  publishedAt!: Date | null;

  @ApiPropertyOptional({ type: CategorySummaryDto })
  category!: CategorySummaryDto | null;

  @ApiPropertyOptional({ type: ArticleDetailDto })
  article?: ArticleDetailDto;
}

export class ContentListResponseDto {
  @ApiProperty({ type: [ContentListItemDto] })
  items!: ContentListItemDto[];

  @ApiPropertyOptional()
  nextCursor!: string | null;
}
