import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IngestionService } from './ingestion.service';
import { INGESTION_QUEUE, FETCH_SOURCE_JOB } from './ingestion-queue.service';

export interface FetchSourceJobData {
  sourceId: string;
}

@Processor(INGESTION_QUEUE, { concurrency: 2 })
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(private readonly ingestionService: IngestionService) {
    super();
  }

  async process(job: Job<FetchSourceJobData>): Promise<void> {
    if (job.name !== FETCH_SOURCE_JOB) {
      this.logger.warn({ msg: 'Unknown job name', jobName: job.name });
      return;
    }

    this.logger.log({
      msg: 'Processing ingestion job',
      jobId: job.id,
      sourceId: job.data.sourceId,
    });

    const result = await this.ingestionService.ingestSource(job.data.sourceId);

    this.logger.log({
      msg: 'Ingestion job completed',
      jobId: job.id,
      ...result,
    });
  }
}
