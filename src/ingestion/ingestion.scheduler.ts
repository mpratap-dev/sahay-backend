import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IngestionQueueService } from './ingestion-queue.service';

@Injectable()
export class IngestionScheduler {
  private readonly logger = new Logger(IngestionScheduler.name);

  constructor(private readonly ingestionQueueService: IngestionQueueService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleIngestion(): Promise<void> {
    const count = await this.ingestionQueueService.enqueueActiveSources();
    this.logger.log({ msg: 'Scheduled ingestion jobs', jobCount: count });
  }
}
