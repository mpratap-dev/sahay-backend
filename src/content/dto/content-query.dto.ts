import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ContentStatus, ContentType } from '../../generated/prisma/enums';

export enum ContentSort {
  PUBLISHED_AT_DESC = 'publishedAt:desc',
  PUBLISHED_AT_ASC = 'publishedAt:asc',
}

function parseCommaSeparated(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry: unknown) => {
      if (
        typeof entry === 'string' ||
        typeof entry === 'number' ||
        typeof entry === 'boolean'
      ) {
        return String(entry)
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);
      }
      return [];
    });
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return undefined;
}

export class ContentQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseCommaSeparated(value))
  @IsEnum(ContentType, { each: true })
  type?: ContentType[];

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus = ContentStatus.PUBLISHED;

  @IsOptional()
  @Transform(({ value }) => parseCommaSeparated(value))
  @IsString({ each: true })
  category?: string[];

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsEnum(ContentSort)
  sort?: ContentSort = ContentSort.PUBLISHED_AT_DESC;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
