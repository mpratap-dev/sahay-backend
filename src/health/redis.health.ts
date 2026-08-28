import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Redis } from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly configService: ConfigService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const redis = new Redis({
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: this.configService.getOrThrow<number>('REDIS_PORT'),
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
    });

    try {
      const pong: string = await redis.ping();
      if (pong !== 'PONG') {
        return indicator.down(`Unexpected Redis ping response: ${pong}`);
      }
      return indicator.up();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return indicator.down(message);
    } finally {
      redis.disconnect();
    }
  }
}
