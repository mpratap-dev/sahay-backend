import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
} from 'class-validator';
import { InterestArea, LocationKind } from '../../generated/prisma/enums';

export class TopicViewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;
}

export class InterestAreaViewDto {
  @ApiProperty({ enum: InterestArea })
  area!: InterestArea;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: [TopicViewDto] })
  topics!: TopicViewDto[];
}

export class LocationViewDto {
  @ApiProperty({ enum: LocationKind })
  kind!: LocationKind;

  @ApiProperty()
  latitude!: number;

  @ApiProperty()
  longitude!: number;

  @ApiPropertyOptional()
  premise!: string | null;

  @ApiPropertyOptional()
  neighborhood!: string | null;

  @ApiPropertyOptional()
  sublocalityLevel3!: string | null;

  @ApiPropertyOptional()
  sublocalityLevel2!: string | null;

  @ApiPropertyOptional()
  sublocalityLevel1!: string | null;

  @ApiPropertyOptional()
  locality!: string | null;

  @ApiPropertyOptional()
  administrativeAreaLevel3!: string | null;

  @ApiPropertyOptional()
  administrativeAreaLevel2!: string | null;

  @ApiPropertyOptional()
  administrativeAreaLevel1!: string | null;

  @ApiPropertyOptional()
  country!: string | null;

  @ApiPropertyOptional()
  countryCode!: string | null;

  @ApiPropertyOptional()
  postalCode!: string | null;

  @ApiPropertyOptional()
  placeId!: string | null;

  @ApiProperty()
  capturedAt!: Date;
}

export class TopicPreferencesDto {
  @ApiProperty({ type: [TopicViewDto] })
  followed!: TopicViewDto[];

  @ApiProperty({ type: [TopicViewDto] })
  excluded!: TopicViewDto[];
}

export class PersonalizationResponseDto {
  @ApiProperty()
  hasLocation!: boolean;

  @ApiProperty()
  hasInterestAreas!: boolean;

  @ApiProperty()
  hasFollowedTopics!: boolean;

  @ApiPropertyOptional({ type: LocationViewDto })
  location!: LocationViewDto | null;

  @ApiProperty({ enum: InterestArea, isArray: true })
  interestAreas!: InterestArea[];

  @ApiProperty({ type: TopicPreferencesDto })
  topics!: TopicPreferencesDto;
}

export class UpsertLocationDto {
  @ApiProperty({ example: 28.6139 })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 77.209 })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;
}

export class ReplaceInterestAreasDto {
  @ApiProperty({ enum: InterestArea, isArray: true })
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsEnum(InterestArea, { each: true })
  areas!: InterestArea[];
}

export class PatchTopicsDto {
  @ApiPropertyOptional({ type: [String], example: ['politics', 'sports'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  followed?: string[];

  @ApiPropertyOptional({ type: [String], example: ['entertainment'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  unfollowed?: string[];
}
