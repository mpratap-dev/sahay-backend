import { Test, TestingModule } from '@nestjs/testing';
import { IngestionProcessor } from './ingestion.processor';
import { IngestionService } from './ingestion.service';

describe('IngestionProcessor', () => {
  let processor: IngestionProcessor;
  const ingestSource = jest.fn().mockResolvedValue({
    sourceId: 'source-1',
    itemsFetched: 5,
    newRawArticles: 2,
    articlesNormalized: 2,
    durationMs: 100,
  });

  beforeEach(async () => {
    ingestSource.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionProcessor,
        {
          provide: IngestionService,
          useValue: { ingestSource },
        },
      ],
    }).compile();

    processor = module.get(IngestionProcessor);
  });

  it('processes fetch-source jobs', async () => {
    await processor.process({
      id: 'job-1',
      name: 'fetch-source',
      data: { sourceId: 'source-1' },
    } as never);

    expect(ingestSource).toHaveBeenCalledWith('source-1');
  });

  it('ignores unknown job names', async () => {
    await processor.process({
      id: 'job-2',
      name: 'other-job',
      data: { sourceId: 'source-1' },
    } as never);

    expect(ingestSource).not.toHaveBeenCalled();
  });
});
