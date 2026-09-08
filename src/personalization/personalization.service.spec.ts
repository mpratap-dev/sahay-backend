import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  InterestArea,
  LocationKind,
  UserInterestSource,
  UserInterestStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
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
    upsert: jest.fn(),
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
      ],
    }).compile();

    service = module.get(PersonalizationService);
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
    it('upserts CURRENT location and returns numeric coordinates', async () => {
      const capturedAt = new Date('2026-09-08T10:00:00Z');
      userLocation.upsert.mockResolvedValue({
        kind: LocationKind.CURRENT,
        latitude: { toNumber: () => 28.6139 },
        longitude: { toNumber: () => 77.209 },
        locality: 'New Delhi',
        adminArea: 'Delhi',
        countryCode: 'IN',
        postalCode: '110001',
        capturedAt,
      });

      const result = await service.upsertCurrentLocation('user-1', {
        latitude: 28.6139,
        longitude: 77.209,
        locality: 'New Delhi',
        adminArea: 'Delhi',
        countryCode: 'in',
        postalCode: '110001',
      });

      expect(result.kind).toBe(LocationKind.CURRENT);
      expect(result.latitude).toBe(28.6139);
      expect(result.longitude).toBe(77.209);
      expect(userLocation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_kind: { userId: 'user-1', kind: LocationKind.CURRENT },
          },
          create: expect.objectContaining({
            kind: LocationKind.CURRENT,
            countryCode: 'IN',
          }),
          }) as unknown,
        }),
      );
    });

    it('never writes HOMETOWN', async () => {
      userLocation.upsert.mockResolvedValue({
        kind: LocationKind.CURRENT,
        latitude: 28,
        longitude: 77,
        locality: null,
        adminArea: null,
        countryCode: null,
        postalCode: null,
        capturedAt: new Date(),
      });

      await service.upsertCurrentLocation('user-1', {
        latitude: 28,
        longitude: 77,
      });

      const call = userLocation.upsert.mock.calls[0][0] as {
      const calls = userLocation.upsert.mock.calls as unknown[][];
      const call = calls[0]?.[0] as {
        where: { userId_kind: { kind: LocationKind } };
        create: { kind: LocationKind };
      };
      expect(call.where.userId_kind.kind).toBe(LocationKind.CURRENT);
      expect(call.create.kind).toBe(LocationKind.CURRENT);
      expect(JSON.stringify(call)).not.toContain(LocationKind.HOMETOWN);
    });
  });

  describe('replaceInterestAreas', () => {
    it('replaces the full set in a transaction', async () => {
      userInterestArea.deleteMany.mockResolvedValue({ count: 1 });
      userInterestArea.createMany.mockResolvedValue({ count: 2 });

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
      expect(userInterest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            topicId: politics.id,
            status: UserInterestStatus.FOLLOWED,
            source: UserInterestSource.MANUAL,
          }),
          }) as unknown,
        }),
      );
      expect(userInterest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            topicId: sports.id,
            status: UserInterestStatus.EXCLUDED,
          }),
          }) as unknown,
        }),
      );
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
        locality: null,
        adminArea: null,
        countryCode: 'IN',
        postalCode: null,
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
