import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('SAHAY API (e2e)', () => {
  let app: INestApplication<App>;

  const prismaMock = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    source: {
      findMany: jest.fn().mockResolvedValue([{ id: 'source-1' }]),
    },
    article: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn().mockImplementation(async (ops) => {
      if (Array.isArray(ops)) {
        return [await ops[0], await ops[1]];
      }
      return ops(prismaMock);
    }),
  };

  const queueMock = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(getQueueToken('ingestion'))
      .useValue(queueMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
      });
  });

  it('/articles (GET)', () => {
    return request(app.getHttpServer())
      .get('/articles')
      .expect(200)
      .expect((res) => {
        expect(res.body.items).toEqual([]);
        expect(res.body.total).toBe(0);
      });
  });

  it('/articles/:id (GET) returns 404', () => {
    return request(app.getHttpServer())
      .get('/articles/nonexistent')
      .expect(404);
  });

  it('/articles (GET) rejects invalid limit', () => {
    return request(app.getHttpServer()).get('/articles?limit=200').expect(400);
  });

  it('/ingestion/trigger (POST) enqueues jobs in development', () => {
    return request(app.getHttpServer())
      .post('/ingestion/trigger')
      .expect(201)
      .expect((res) => {
        expect(res.body.scheduled).toBeGreaterThanOrEqual(0);
      });
  });
});
