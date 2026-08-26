import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SourcesModule } from '../sources/sources.module';
import { FetcherRegistry } from './fetchers/fetcher.registry';
import { RssFetcher } from './fetchers/rss.fetcher';
import { IngestionController } from './ingestion.controller';
import { IngestionProcessor } from './ingestion.processor';
import { IngestionQueueService } from './ingestion-queue.service';
import { IngestionScheduler } from './ingestion.scheduler';
import { IngestionService } from './ingestion.service';
import { ArticleDedupService } from './article-dedup.service';
import { NormalizationService } from './normalization.service';

@Module({})
export class IngestionModule {
  static register(): DynamicModule {
    const isProduction = process.env.NODE_ENV === 'production';
    const isTest = process.env.NODE_ENV === 'test';

    const workerProviders = isTest
      ? []
      : [IngestionProcessor, IngestionScheduler];

    return {
      module: IngestionModule,
      imports: [SourcesModule, BullModule.registerQueue({ name: 'ingestion' })],
      controllers: isProduction ? [] : [IngestionController],
      providers: [
        RssFetcher,
        FetcherRegistry,
        NormalizationService,
        ArticleDedupService,
        IngestionService,
        IngestionQueueService,
        ...workerProviders,
      ],
      exports: [IngestionService, IngestionQueueService],
    };
  }
}
