export interface FetchedItem {
  externalId: string;
  payload: Record<string, unknown>;
}

export interface SourceFetcher {
  fetch(feedUrl: string): Promise<FetchedItem[]>;
}
