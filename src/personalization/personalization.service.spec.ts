import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ContentService } from '../content/content.service';
import {
  InterestArea,
  LocationKind,
  UserInterestSource,
  UserInterestStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { FeedFilter } from './dto/personalization.dto';
import { GoogleGeocodeClient } from './google-geocode.client';
import { PersonalizationService } from './personalization.service';

describe('PersonalizationService', () => {
  let service: PersonalizationService;

  const topic = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  };
  const userLocation = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  };
  const userInterestArea = {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  };
  const userInterest = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  };
  const interestAreaTopic = {
    findMany: jest.fn(),
  };
  const prisma = {
    topic,
    userLocation,
    userInterestArea,
    userInterest,
    interestAreaTopic,
    $transaction: jest.fn(),
  };

  const googleGeocode = {
    reverseGeocode: jest.fn(),
  };

  const contentService = {
    findAll: jest.fn(),
  };

  const politics = { id: 't-pol', slug: 'politics', name: 'Politics' };
  const sports = { id: 't-spo', slug: 'sports', name: 'Sports' };
  const science = { id: 't-sci', slug: 'science', name: 'Science' };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalizationService,
        { provide: PrismaService, useValue: prisma },
        { provide: GoogleGeocodeClient, useValue: googleGeocode },
        { provide: ContentService, useValue: contentService },
      ],
    }).compile();

    service = module.get(PersonalizationService);
  });

  describe('getFeed', () => {
    it('returns empty feed when user follows no topics for filter=all', async () => {
      userInterest.findMany.mockResolvedValue([]);

      const result = await service.getFeed('user-1', {
        filter: FeedFilter.ALL,
      });

      expect(result).toEqual({ items: [], nextCursor: null });
      expect(contentService.findAll).not.toHaveBeenCalled();
    });

    it('delegates filter=all to content service with followed topic ids', async () => {
      userInterest.findMany.mockResolvedValue([
        { topicId: politics.id },
        { topicId: sports.id },
      ]);
      contentService.findAll.mockResolvedValue({ items: [], nextCursor: null });

      await service.getFeed('user-1', { filter: FeedFilter.ALL, limit: 10 });

      expect(contentService.findAll).toHaveBeenCalledWith({
        topic: [politics.id, sports.id],
        cursor: undefined,
        limit: 10,
      });
    });

    it('throws when filter=nearby and user has no location', async () => {
      userLocation.findUnique.mockResolvedValue(null);

      await expect(
        service.getFeed('user-1', { filter: FeedFilter.NEARBY }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('delegates filter=nearby with place names from stored location', async () => {
      userLocation.findUnique.mockResolvedValue({
        kind: LocationKind.CURRENT,
        latitude: 28.6,
        longitude: 77.2,
        ...emptyAddressFields(),
        sublocalityLevel2: 'Uttam Nagar',
        locality: 'New Delhi',
        administrativeAreaLevel1: 'Delhi',
        countryCode: 'IN',
        capturedAt: new Date('2026-09-08T10:00:00Z'),
      });
      contentService.findAll.mockResolvedValue({ items: [], nextCursor: null });

      await service.getFeed('user-1', { filter: FeedFilter.NEARBY });

      expect(contentService.findAll).toHaveBeenCalledWith({
        topic: undefined,
        mentions: ['Uttam Nagar', 'New Delhi', 'Delhi'],
        cursor: undefined,
        limit: undefined,
      });
    });

    it('delegates filter=topic to content service with topic param', async () => {
      contentService.findAll.mockResolvedValue({ items: [], nextCursor: null });

      await service.getFeed('user-1', {
        filter: FeedFilter.TOPIC,
        topic: politics.id,
      });

      expect(contentService.findAll).toHaveBeenCalledWith({
        topic: [politics.id],
        cursor: undefined,
        limit: undefined,
      });
    });
  });

  describe('listTopics', () => {
    it('returns the catalogue ordered by name', async () => {
      topic.findMany.mockResolvedValue([politics, sports]);

      await expect(service.listTopics()).resolves.toEqual([politics, sports]);
      expect(topic.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        select: { id: true, slug: true, name: true },
      });
    });
  });

  describe('upsertCurrentLocation', () => {
    it('geocodes then upserts CURRENT location and returns numeric coordinates', async () => {
      const capturedAt = new Date('2026-09-08T10:00:00Z');
      googleGeocode.reverseGeocode.mockResolvedValue({
        place_id: 'place-delhi',
        address_components: [
          {
            long_name: 'New Delhi',
            short_name: 'New Delhi',
            types: ['locality', 'political'],
          },
          {
            long_name: 'India',
            short_name: 'in',
            types: ['country', 'political'],
          },
          {
            long_name: '110001',
            short_name: '110001',
            types: ['postal_code'],
          },
        ],
      });
      userLocation.upsert.mockResolvedValue({
        kind: LocationKind.CURRENT,
        latitude: { toNumber: () => 28.6139 },
        longitude: { toNumber: () => 77.209 },
        ...emptyAddressFields(),
        locality: 'New Delhi',
        country: 'India',
        countryCode: 'IN',
        postalCode: '110001',
        placeId: 'place-delhi',
        capturedAt,
      });

      const result = await service.upsertCurrentLocation('user-1', {
        latitude: 28.6139,
        longitude: 77.209,
      });

      expect(googleGeocode.reverseGeocode).toHaveBeenCalledWith(
        28.6139,
        77.209,
      );
      expect(result.kind).toBe(LocationKind.CURRENT);
      expect(result.latitude).toBe(28.6139);
      expect(result.longitude).toBe(77.209);
      expect(result.locality).toBe('New Delhi');
      expect(result.countryCode).toBe('IN');
      const upsertPayload = firstMockCall(userLocation.upsert);
      expect(upsertPayload).toMatchObject({
        where: {
          userId_kind: { userId: 'user-1', kind: LocationKind.CURRENT },
        },
        create: {
          kind: LocationKind.CURRENT,
          locality: 'New Delhi',
          country: 'India',
          countryCode: 'IN',
          placeId: 'place-delhi',
        },
      });
    });

    it('never writes HOMETOWN', async () => {
      googleGeocode.reverseGeocode.mockResolvedValue(null);
      userLocation.upsert.mockResolvedValue({
        kind: LocationKind.CURRENT,
        latitude: 28,
        longitude: 77,
        ...emptyAddressFields(),
        capturedAt: new Date(),
      });

      await service.upsertCurrentLocation('user-1', {
        latitude: 28,
        longitude: 77,
      });

      const call = firstMockCall(userLocation.upsert);
      expect(call).toMatchObject({
        where: { userId_kind: { kind: LocationKind.CURRENT } },
        create: { kind: LocationKind.CURRENT },
      });
      expect(JSON.stringify(call)).not.toContain(LocationKind.HOMETOWN);
    });
  });

  describe('replaceInterestAreas', () => {
    it('replaces the full set in a transaction', async () => {
      userInterestArea.deleteMany.mockResolvedValue({ count: 1 });
      userInterestArea.createMany.mockResolvedValue({ count: 2 });
      interestAreaTopic.findMany.mockResolvedValue([]);
      userInterest.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.replaceInterestAreas('user-1', {
        areas: [
          InterestArea.TECHNOLOGY_SCIENCE_ENGINEERING,
          InterestArea.LAW_GOVERNMENT_PUBLIC_SERVICES,
        ],
      });

      expect(result.interestAreas).toEqual([
        InterestArea.TECHNOLOGY_SCIENCE_ENGINEERING,
        InterestArea.LAW_GOVERNMENT_PUBLIC_SERVICES,
      ]);
      expect(userInterestArea.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(userInterestArea.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: 'user-1',
            area: InterestArea.TECHNOLOGY_SCIENCE_ENGINEERING,
          },
          {
            userId: 'user-1',
            area: InterestArea.LAW_GOVERNMENT_PUBLIC_SERVICES,
          },
        ],
      });
    });

    it('creates ONBOARDING follows for topics mapped to selected areas', async () => {
      userInterestArea.deleteMany.mockResolvedValue({ count: 0 });
      userInterestArea.createMany.mockResolvedValue({ count: 1 });
      interestAreaTopic.findMany.mockResolvedValue([
        { topicId: science.id },
        { topicId: politics.id },
      ]);
      userInterest.deleteMany.mockResolvedValue({ count: 0 });
      userInterest.findUnique.mockResolvedValue(null);
      userInterest.upsert.mockResolvedValue({});

      await service.replaceInterestAreas('user-1', {
        areas: [InterestArea.TECHNOLOGY_SCIENCE_ENGINEERING],
      });

      expect(interestAreaTopic.findMany).toHaveBeenCalledWith({
        where: {
          area: { in: [InterestArea.TECHNOLOGY_SCIENCE_ENGINEERING] },
        },
        select: { topicId: true },
      });
      expect(userInterest.upsert).toHaveBeenCalledTimes(2);
      expect(userInterest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_topicId: { userId: 'user-1', topicId: science.id } },
          create: {
            userId: 'user-1',
            topicId: science.id,
            status: UserInterestStatus.FOLLOWED,
            source: UserInterestSource.ONBOARDING,
          },
        }),
      );
    });

    it('deletes stale ONBOARDING follows when an area is removed on re-save', async () => {
      userInterestArea.deleteMany.mockResolvedValue({ count: 1 });
      userInterestArea.createMany.mockResolvedValue({ count: 1 });
      interestAreaTopic.findMany.mockResolvedValue([{ topicId: science.id }]);
      userInterest.deleteMany.mockResolvedValue({ count: 1 });
      userInterest.findUnique.mockResolvedValue(null);
      userInterest.upsert.mockResolvedValue({});

      await service.replaceInterestAreas('user-1', {
        areas: [InterestArea.TECHNOLOGY_SCIENCE_ENGINEERING],
      });

      expect(userInterest.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          source: UserInterestSource.ONBOARDING,
          status: UserInterestStatus.FOLLOWED,
          topicId: { notIn: [science.id] },
        },
      });
    });

    it('does not override EXCLUDED rows', async () => {
      userInterestArea.deleteMany.mockResolvedValue({ count: 0 });
      userInterestArea.createMany.mockResolvedValue({ count: 1 });
      interestAreaTopic.findMany.mockResolvedValue([{ topicId: science.id }]);
      userInterest.deleteMany.mockResolvedValue({ count: 0 });
      userInterest.findUnique.mockResolvedValue({
        status: UserInterestStatus.EXCLUDED,
        source: UserInterestSource.MANUAL,
      });

      await service.replaceInterestAreas('user-1', {
        areas: [InterestArea.TECHNOLOGY_SCIENCE_ENGINEERING],
      });

      expect(userInterest.upsert).not.toHaveBeenCalled();
    });

    it('does not change MANUAL FOLLOWED rows', async () => {
      userInterestArea.deleteMany.mockResolvedValue({ count: 0 });
      userInterestArea.createMany.mockResolvedValue({ count: 1 });
      interestAreaTopic.findMany.mockResolvedValue([{ topicId: sports.id }]);
      userInterest.deleteMany.mockResolvedValue({ count: 0 });
      userInterest.findUnique.mockResolvedValue({
        status: UserInterestStatus.FOLLOWED,
        source: UserInterestSource.MANUAL,
      });

      await service.replaceInterestAreas('user-1', {
        areas: [InterestArea.TECHNOLOGY_SCIENCE_ENGINEERING],
      });

      expect(userInterest.upsert).not.toHaveBeenCalled();
    });
  });

  describe('patchTopics', () => {
    it('follows and excludes by slug without replacing other follows', async () => {
      topic.findMany.mockResolvedValue([politics, sports]);
      userInterest.upsert.mockResolvedValue({});
      userInterest.findMany.mockResolvedValue([
        { status: UserInterestStatus.FOLLOWED, topic: politics },
        { status: UserInterestStatus.FOLLOWED, topic: science },
        { status: UserInterestStatus.EXCLUDED, topic: sports },
      ]);

      const result = await service.patchTopics('user-1', {
        followed: ['politics', 'POLITICS'],
        unfollowed: ['sports'],
      });

      expect(result.followed.map((row) => row.slug)).toEqual([
        'politics',
        'science',
      ]);
      expect(result.excluded.map((row) => row.slug)).toEqual(['sports']);
      expect(userInterest.upsert).toHaveBeenCalledTimes(2);
      const followedCall = firstMockCall(userInterest.upsert);
      const excludedCall = mockCallAt(userInterest.upsert, 1);
      expect(followedCall).toMatchObject({
        create: {
          topicId: politics.id,
          status: UserInterestStatus.FOLLOWED,
          source: UserInterestSource.MANUAL,
        },
      });
      expect(excludedCall).toMatchObject({
        create: {
          topicId: sports.id,
          status: UserInterestStatus.EXCLUDED,
        },
      });
    });

    it('rejects unknown slugs', async () => {
      topic.findMany.mockResolvedValue([]);

      await expect(
        service.patchTopics('user-1', { followed: ['bollywood'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects slugs in both followed and unfollowed', async () => {
      await expect(
        service.patchTopics('user-1', {
          followed: ['politics'],
          unfollowed: ['politics'],
        }),
      ).rejects.toThrow(/both followed and unfollowed/);
      expect(topic.findMany).not.toHaveBeenCalled();
    });

    it('rejects empty patch', async () => {
      await expect(service.patchTopics('user-1', {})).rejects.toThrow(
        /at least one/,
      );
    });
  });

  describe('getPersonalization', () => {
    it('reports empty completeness flags', async () => {
      userLocation.findUnique.mockResolvedValue(null);
      userInterestArea.findMany.mockResolvedValue([]);
      userInterest.findMany.mockResolvedValue([]);

      const result = await service.getPersonalization('user-1');

      expect(result).toEqual({
        hasLocation: false,
        hasInterestAreas: false,
        hasFollowedTopics: false,
        location: null,
        interestAreas: [],
        topics: { followed: [], excluded: [] },
      });
    });

    it('reports filled completeness flags', async () => {
      userLocation.findUnique.mockResolvedValue({
        kind: LocationKind.CURRENT,
        latitude: 28.6,
        longitude: 77.2,
        ...emptyAddressFields(),
        countryCode: 'IN',
        capturedAt: new Date('2026-09-08T10:00:00Z'),
      });
      userInterestArea.findMany.mockResolvedValue([
        { area: InterestArea.TECHNOLOGY_SCIENCE_ENGINEERING },
      ]);
      userInterest.findMany.mockResolvedValue([
        { status: UserInterestStatus.FOLLOWED, topic: science },
        { status: UserInterestStatus.EXCLUDED, topic: sports },
      ]);

      const result = await service.getPersonalization('user-1');

      expect(result.hasLocation).toBe(true);
      expect(result.hasInterestAreas).toBe(true);
      expect(result.hasFollowedTopics).toBe(true);
      expect(result.interestAreas).toEqual([
        InterestArea.TECHNOLOGY_SCIENCE_ENGINEERING,
      ]);
      expect(result.topics.followed).toEqual([science]);
    });
  });
});

function emptyAddressFields() {
  return {
    premise: null,
    neighborhood: null,
    sublocalityLevel3: null,
    sublocalityLevel2: null,
    sublocalityLevel1: null,
    locality: null,
    administrativeAreaLevel3: null,
    administrativeAreaLevel2: null,
    administrativeAreaLevel1: null,
    country: null,
    countryCode: null,
    postalCode: null,
    placeId: null,
  };
}

function mockCallAt(
  mockFn: { mock: { calls: unknown[][] } },
  index: number,
): unknown {
  const payload = mockFn.mock.calls[index]?.[0];
  if (payload === undefined) {
    throw new Error(`Missing mock call at index ${String(index)}`);
  }
  return payload;
}

function firstMockCall(mockFn: { mock: { calls: unknown[][] } }): unknown {
  return mockCallAt(mockFn, 0);
}
