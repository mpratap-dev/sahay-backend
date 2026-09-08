import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  InterestArea,
  LocationKind,
  UserInterestSource,
  UserInterestStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  InterestAreaViewDto,
  LocationViewDto,
  PatchTopicsDto,
  PersonalizationResponseDto,
  ReplaceInterestAreasDto,
  TopicPreferencesDto,
  TopicViewDto,
  UpsertLocationDto,
} from './dto/personalization.dto';
import { INTEREST_AREA_LABELS } from './interest-areas';

type TopicRow = { id: string; slug: string; name: string };

@Injectable()
export class PersonalizationService {
  constructor(private readonly prisma: PrismaService) {}

  async listTopics(): Promise<TopicViewDto[]> {
    const topics = await this.prisma.topic.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true },
    });
    return topics.map(toTopicView);
  }

  async listInterestAreas(): Promise<InterestAreaViewDto[]> {
    const rows = await this.prisma.interestAreaTopic.findMany({
      include: { topic: { select: { id: true, slug: true, name: true } } },
    });

    const byArea = new Map<InterestArea, TopicViewDto[]>();
    for (const area of Object.values(InterestArea)) {
      byArea.set(area, []);
    }
    for (const row of rows) {
      byArea.get(row.area)?.push(toTopicView(row.topic));
    }

    return Object.values(InterestArea).map((area) => ({
      area,
      name: INTEREST_AREA_LABELS[area],
      topics: byArea.get(area) ?? [],
    }));
  }

  async getPersonalization(
    userId: string,
  ): Promise<PersonalizationResponseDto> {
    const [location, interestAreas, topics] = await Promise.all([
      this.findCurrentLocation(userId),
      this.prisma.userInterestArea.findMany({
        where: { userId },
        select: { area: true },
        orderBy: { area: 'asc' },
      }),
      this.getTopicPreferences(userId),
    ]);

    return {
      hasLocation: location !== null,
      hasInterestAreas: interestAreas.length > 0,
      hasFollowedTopics: topics.followed.length > 0,
      location,
      interestAreas: interestAreas.map((row) => row.area),
      topics,
    };
  }

  async upsertCurrentLocation(
    userId: string,
    dto: UpsertLocationDto,
  ): Promise<LocationViewDto> {
    const capturedAt = new Date();
    const row = await this.prisma.userLocation.upsert({
      where: {
        userId_kind: { userId, kind: LocationKind.CURRENT },
      },
      create: {
        userId,
        kind: LocationKind.CURRENT,
        latitude: dto.latitude,
        longitude: dto.longitude,
        locality: emptyToNull(dto.locality),
        adminArea: emptyToNull(dto.adminArea),
        countryCode: emptyToNull(dto.countryCode)?.toUpperCase(),
        postalCode: emptyToNull(dto.postalCode),
        capturedAt,
      },
      update: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        locality: emptyToNull(dto.locality),
        adminArea: emptyToNull(dto.adminArea),
        countryCode: emptyToNull(dto.countryCode)?.toUpperCase(),
        postalCode: emptyToNull(dto.postalCode),
        capturedAt,
      },
    });
    return toLocationView(row);
  }

  async replaceInterestAreas(
    userId: string,
    dto: ReplaceInterestAreasDto,
  ): Promise<{ interestAreas: InterestArea[] }> {
    const areas = [...new Set(dto.areas)];
    await this.prisma.$transaction(async (tx) => {
      await tx.userInterestArea.deleteMany({ where: { userId } });
      await tx.userInterestArea.createMany({
        data: areas.map((area) => ({ userId, area })),
      });
    });
    return { interestAreas: areas };
  }

  async getTopicPreferences(userId: string): Promise<TopicPreferencesDto> {
    const rows = await this.prisma.userInterest.findMany({
      where: { userId },
      include: { topic: { select: { id: true, slug: true, name: true } } },
      orderBy: { topic: { name: 'asc' } },
    });

    const followed: TopicViewDto[] = [];
    const excluded: TopicViewDto[] = [];
    for (const row of rows) {
      const view = toTopicView(row.topic);
      if (row.status === UserInterestStatus.FOLLOWED) {
        followed.push(view);
      } else {
        excluded.push(view);
      }
    }
    return { followed, excluded };
  }

  async patchTopics(
    userId: string,
    dto: PatchTopicsDto,
  ): Promise<TopicPreferencesDto> {
    const followedSlugs = uniqueSlugs(dto.followed);
    const unfollowedSlugs = uniqueSlugs(dto.unfollowed);

    if (followedSlugs.length === 0 && unfollowedSlugs.length === 0) {
      throw new BadRequestException(
        'Provide at least one of followed or unfollowed',
      );
    }

    const overlap = followedSlugs.filter((slug) =>
      unfollowedSlugs.includes(slug),
    );
    if (overlap.length > 0) {
      throw new BadRequestException(
        `Topics cannot be both followed and unfollowed: ${overlap.join(', ')}`,
      );
    }

    const requested = [...followedSlugs, ...unfollowedSlugs];
    const topics = await this.prisma.topic.findMany({
      where: { slug: { in: requested } },
      select: { id: true, slug: true },
    });
    const bySlug = new Map(topics.map((topic) => [topic.slug, topic.id]));
    const unknown = requested.filter((slug) => !bySlug.has(slug));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown topic slugs: ${unknown.join(', ')}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const slug of followedSlugs) {
        const topicId = bySlug.get(slug);
        if (!topicId) {
          continue;
        }
        await tx.userInterest.upsert({
          where: { userId_topicId: { userId, topicId } },
          create: {
            userId,
            topicId,
            status: UserInterestStatus.FOLLOWED,
            source: UserInterestSource.MANUAL,
          },
          update: {
            status: UserInterestStatus.FOLLOWED,
            source: UserInterestSource.MANUAL,
          },
        });
      }
      for (const slug of unfollowedSlugs) {
        const topicId = bySlug.get(slug);
        if (!topicId) {
          continue;
        }
        await tx.userInterest.upsert({
          where: { userId_topicId: { userId, topicId } },
          create: {
            userId,
            topicId,
            status: UserInterestStatus.EXCLUDED,
            source: UserInterestSource.MANUAL,
          },
          update: {
            status: UserInterestStatus.EXCLUDED,
            source: UserInterestSource.MANUAL,
          },
        });
      }
    });

    return this.getTopicPreferences(userId);
  }

  private async findCurrentLocation(
    userId: string,
  ): Promise<LocationViewDto | null> {
    const row = await this.prisma.userLocation.findUnique({
      where: { userId_kind: { userId, kind: LocationKind.CURRENT } },
    });
    return row ? toLocationView(row) : null;
  }
}

function uniqueSlugs(values: string[] | undefined): string[] {
  if (!values) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const slug = value.trim().toLowerCase();
    if (!slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    result.push(slug);
  }
  return result;
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTopicView(topic: TopicRow): TopicViewDto {
  return { id: topic.id, slug: topic.slug, name: topic.name };
}

function toCoord(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function toLocationView(row: {
  kind: LocationKind;
  latitude: Prisma.Decimal | number;
  longitude: Prisma.Decimal | number;
  locality: string | null;
  adminArea: string | null;
  countryCode: string | null;
  postalCode: string | null;
  capturedAt: Date;
}): LocationViewDto {
  return {
    kind: row.kind,
    latitude: toCoord(row.latitude),
    longitude: toCoord(row.longitude),
    locality: row.locality,
    adminArea: row.adminArea,
    countryCode: row.countryCode,
    postalCode: row.postalCode,
    capturedAt: row.capturedAt,
  };
}
