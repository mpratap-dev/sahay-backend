import { Injectable } from '@nestjs/common';
import { SourceFetcher } from './fetcher.interface';
import { RssFetcher } from './rss.fetcher';

@Injectable()
export class FetcherRegistry {
  constructor(private readonly rssFetcher: RssFetcher) {}

  getFetcherForSource(): SourceFetcher {
    // Phase 1: all sources use RSS transport via SourceFeed.url
    return this.rssFetcher;
  }
}
