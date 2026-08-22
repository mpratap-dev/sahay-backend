import { Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IngestionQueueService } from './ingestion-queue.service';

@ApiTags('ingestion')
@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionQueueService: IngestionQueueService) {}

  @Post('trigger')
  @ApiOperation({
    summary: 'Trigger ingestion for all active sources (development only)',
    description:
      'Enqueues ingestion jobs for all active sources. Only available when NODE_ENV is not production.',
  })
  async triggerIngestion(): Promise<{ scheduled: number }> {
    const scheduled = await this.ingestionQueueService.enqueueActiveSources();
    return { scheduled };
  }
}
