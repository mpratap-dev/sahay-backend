import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { IngestionQueueService } from './ingestion-queue.service';
import { SourcesService } from '../sources/sources.service';

describe('IngestionQueueService', () => {
  let service: IngestionQueueService;
  const queueAdd = jest.fn();

  beforeEach(async () => {
    queueAdd.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionQueueService,
        {
          provide: getQueueToken('ingestion'),
          useValue: { add: queueAdd },
        },
        {
          provide: SourcesService,
          useValue: {
            findActiveSources: jest
              .fn()
              .mockResolvedValue([{ id: 'source-1' }, { id: 'source-2' }]),
          },
        },
      ],
    }).compile();

    service = module.get(IngestionQueueService);
  });

  it('enqueues jobs for active sources with expected payload', async () => {
    const count = await service.enqueueActiveSources();

    expect(count).toBe(2);
    expect(queueAdd).toHaveBeenCalledTimes(2);
    expect(queueAdd).toHaveBeenCalledWith(
      'fetch-source',
      { sourceId: 'source-1' },
      expect.objectContaining({
        attempts: 3,
        deduplication: { id: 'ingestion:source-1' },
      }),
    );
  });
});
