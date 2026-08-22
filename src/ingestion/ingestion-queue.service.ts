import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SourcesService } from '../sources/sources.service';

const INGESTION_QUEUE = 'ingestion';
const FETCH_SOURCE_JOB = 'fetch-source';

@Injectable()
export class IngestionQueueService {
  constructor(
    @InjectQueue(INGESTION_QUEUE) private readonly ingestionQueue: Queue,
    private readonly sourcesService: SourcesService,
  ) {}

  async enqueueSourceIngestion(sourceId: string) {
    await this.ingestionQueue.add(
      FETCH_SOURCE_JOB,
      { sourceId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        deduplication: { id: `ingestion:${sourceId}` },
        removeOnComplete: { count: 100, age: 3600 },
        removeOnFail: { count: 500, age: 86400 },
      },
    );
  }

  async enqueueActiveSources(): Promise<number> {
    const sources = await this.sourcesService.findActiveSources();
    for (const source of sources) {
      await this.enqueueSourceIngestion(source.id);
    }
    return sources.length;
  }
}
