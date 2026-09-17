import { BadRequestException, Injectable } from '@nestjs/common';
import { ContentService } from '../content/content.service';
import { ContentListResponseDto } from '../content/dto/content-response.dto';
import { Prisma } from '../generated/prisma/client';
import {
  InterestArea,
  LocationKind,
  UserInterestSource,
  UserInterestStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  FeedFilter,
  FeedQueryDto,
  InterestAreaViewDto,
  LocationViewDto,
  PatchTopicsDto,
  PersonalizationResponseDto,
  ReplaceInterestAreasDto,
  TopicPreferencesDto,
  TopicViewDto,
  UpsertLocationDto,
} from './dto/personalization.dto';
import { placeNamesFromLocation } from './location-place-names';
import { GoogleGeocodeClient } from './google-geocode.client';
import type { CurrentLocationFields } from './google-geocode.types';
import { INTEREST_AREA_LABELS } from './interest-areas';
import { mapGeocodeResult } from './map-address-components';

type TopicRow = { id: string; slug: string; name: string };

type PersonalizationTransactionClient = Pick<
  PrismaService,
  'interestAreaTopic' | 'userInterest'
>;

@Injectable()
export class PersonalizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleGeocode: GoogleGeocodeClient,
    private readonly contentService: ContentService,
  ) {}

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
    const geocodeResult = await this.googleGeocode.reverseGeocode(
      dto.latitude,
      dto.longitude,
    );
    const fields = mapGeocodeResult(geocodeResult, dto.latitude, dto.longitude);
    return this.persistCurrentLocation(userId, fields);
  }

  private async persistCurrentLocation(
    userId: string,
    fields: CurrentLocationFields,
  ): Promise<LocationViewDto> {
    const capturedAt = new Date();
    const locationData = {
      latitude: fields.latitude,
      longitude: fields.longitude,
      premise: fields.premise,
      neighborhood: fields.neighborhood,
      sublocalityLevel3: fields.sublocalityLevel3,
      sublocalityLevel2: fields.sublocalityLevel2,
      sublocalityLevel1: fields.sublocalityLevel1,
      locality: fields.locality,
      administrativeAreaLevel3: fields.administrativeAreaLevel3,
      administrativeAreaLevel2: fields.administrativeAreaLevel2,
      administrativeAreaLevel1: fields.administrativeAreaLevel1,
      country: fields.country,
      countryCode: fields.countryCode,
      postalCode: fields.postalCode,
      placeId: fields.placeId,
      capturedAt,
    };
    const row = await this.prisma.userLocation.upsert({
      where: {
        userId_kind: { userId, kind: LocationKind.CURRENT },
      },
      create: {
        userId,
        kind: LocationKind.CURRENT,
        ...locationData,
      },
      update: locationData,
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
      await this.syncTopicsFromInterestAreas(tx, userId, areas);
    });
    return { interestAreas: areas };
  }

  private async syncTopicsFromInterestAreas(
    tx: PersonalizationTransactionClient,
    userId: string,
    areas: InterestArea[],
  ): Promise<void> {
    // Resolve catalogue topics implied by the user's current area selection.
    const mappings = await tx.interestAreaTopic.findMany({
      where: { area: { in: areas } },
      select: { topicId: true },
    });
    const topicIds = [...new Set(mappings.map((row) => row.topicId))];

    // Drop ONBOARDING follows from a previous area set; keep MANUAL and EXCLUDED rows.
    await tx.userInterest.deleteMany({
      where: {
        userId,
        source: UserInterestSource.ONBOARDING,
        status: UserInterestStatus.FOLLOWED,
        ...(topicIds.length > 0 ? { topicId: { notIn: topicIds } } : {}),
      },
    });

    for (const topicId of topicIds) {
      const existing = await tx.userInterest.findUnique({
        where: { userId_topicId: { userId, topicId } },
        select: { status: true, source: true },
      });

      // User explicitly unfollowed — do not re-follow on area re-save.
      if (existing?.status === UserInterestStatus.EXCLUDED) {
        continue;
      }
      // User chose this topic themselves — do not overwrite source or status.
      if (
        existing?.status === UserInterestStatus.FOLLOWED &&
        existing.source === UserInterestSource.MANUAL
      ) {
        continue;
      }

      // Ensure each mapped topic has an ONBOARDING follow unless overridden above.
      await tx.userInterest.upsert({
        where: { userId_topicId: { userId, topicId } },
        create: {
          userId,
          topicId,
          status: UserInterestStatus.FOLLOWED,
          source: UserInterestSource.ONBOARDING,
        },
        update: {
          status: UserInterestStatus.FOLLOWED,
          source: UserInterestSource.ONBOARDING,
        },
      });
    }
  }

  async getFeed(
    userId: string,
    query: FeedQueryDto,
  ): Promise<ContentListResponseDto> {
    let topicValues: string[] | undefined;
    let mentionValues: string[] | undefined;

    switch (query.filter) {
      case FeedFilter.ALL: {
        const rows = await this.prisma.userInterest.findMany({
          where: { userId, status: UserInterestStatus.FOLLOWED },
          select: { topicId: true },
        });
        if (rows.length === 0) {
          return { items: [], nextCursor: null };
        }
        topicValues = rows.map((row) => row.topicId);
        break;
      }
      case FeedFilter.NEARBY: {
        const location = await this.findCurrentLocation(userId);
        if (!location) {
          throw new BadRequestException('Location required for nearby feed');
        }
        const placeNames = placeNamesFromLocation(location);
        if (placeNames.length === 0) {
          return { items: [], nextCursor: null };
        }
        mentionValues = placeNames;
        break;
      }
      case FeedFilter.TOPIC: {
        const topic = query.topic?.trim();
        if (!topic) {
          throw new BadRequestException(
            'topic is required when filter is topic',
          );
        }
        topicValues = [topic];
        break;
      }
    }

    return this.contentService.findAll({
      topic: topicValues,
      mentions: mentionValues,
      cursor: query.cursor,
      limit: query.limit,
    });
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
  premise: string | null;
  neighborhood: string | null;
  sublocalityLevel3: string | null;
  sublocalityLevel2: string | null;
  sublocalityLevel1: string | null;
  locality: string | null;
  administrativeAreaLevel3: string | null;
  administrativeAreaLevel2: string | null;
  administrativeAreaLevel1: string | null;
  country: string | null;
  countryCode: string | null;
  postalCode: string | null;
  placeId: string | null;
  capturedAt: Date;
}): LocationViewDto {
  return {
    kind: row.kind,
    latitude: toCoord(row.latitude),
    longitude: toCoord(row.longitude),
    premise: row.premise,
    neighborhood: row.neighborhood,
    sublocalityLevel3: row.sublocalityLevel3,
    sublocalityLevel2: row.sublocalityLevel2,
    sublocalityLevel1: row.sublocalityLevel1,
    locality: row.locality,
    administrativeAreaLevel3: row.administrativeAreaLevel3,
    administrativeAreaLevel2: row.administrativeAreaLevel2,
    administrativeAreaLevel1: row.administrativeAreaLevel1,
    country: row.country,
    countryCode: row.countryCode,
    postalCode: row.postalCode,
    placeId: row.placeId,
    capturedAt: row.capturedAt,
  };
}
