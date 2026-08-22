import { Injectable, Logger } from '@nestjs/common';
import { parseFeed } from 'feedsmith';
import { createHash } from 'node:crypto';
import { FetchedItem, SourceFetcher } from './fetcher.interface';

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const USER_AGENT = 'SAHAY-Ingestion/1.0';

@Injectable()
export class RssFetcher implements SourceFetcher {
  private readonly logger = new Logger(RssFetcher.name);

  async fetch(feedUrl: string): Promise<FetchedItem[]> {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `Feed fetch failed: ${response.status} ${response.statusText} (${feedUrl})`,
      );
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      throw new Error(
        `Feed response too large: ${contentLength} bytes (${feedUrl})`,
      );
    }

    const xml = await this.readBodyWithLimit(response, MAX_BODY_BYTES);

    let feed: { items?: unknown[] };
    try {
      const parsed = parseFeed(xml);
      feed = parsed.feed as { items?: unknown[] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Feed parse failed (${feedUrl}): ${message}`);
    }

    const items = feed.items ?? [];
    const results: FetchedItem[] = [];
    let skipped = 0;

    for (const item of items) {
      const payload = item as Record<string, unknown>;
      const externalId = this.deriveExternalId(payload);

      if (!externalId) {
        skipped++;
        this.logger.warn({
          msg: 'Skipping RSS item without stable identity',
          feedUrl,
          title: payload.title,
        });
        continue;
      }

      const imageUrl = this.extractImageUrl(payload);
      if (imageUrl) {
        payload.imageUrl = imageUrl;
      }

      results.push({ externalId, payload });
    }

    this.logger.log({
      msg: 'RSS feed fetched',
      feedUrl,
      itemCount: results.length,
      skipped,
    });

    return results;
  }

  private async readBodyWithLimit(
    response: Response,
    maxBytes: number,
  ): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      return await response.text();
    }

    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        throw new Error('Feed response exceeded maximum size limit');
      }
      chunks.push(value);
    }

    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return new TextDecoder().decode(combined);
  }

  private deriveExternalId(payload: Record<string, unknown>): string | null {
    const guid = this.extractGuid(payload);
    if (guid) return guid;

    const link = this.normalizeStableValue(payload.link);
    if (link) return link;

    const normalizedLink = this.normalizeUrl(link);
    if (normalizedLink) {
      return createHash('sha256').update(normalizedLink).digest('hex');
    }

    const title = this.normalizeStableValue(payload.title);
    const publishedAt = this.normalizeStableValue(
      payload.pubDate ?? payload.published ?? payload.updated,
    );

    if (title || publishedAt) {
      const normalized = `${title ?? ''}|${publishedAt ?? ''}`;
      return createHash('sha256').update(normalized).digest('hex');
    }

    return null;
  }

  private extractGuid(payload: Record<string, unknown>): string | undefined {
    const guid = payload.guid;
    if (typeof guid === 'string') {
      return this.normalizeStableValue(guid);
    }
    if (guid && typeof guid === 'object' && 'value' in guid) {
      const value = (guid as { value?: unknown }).value;
      if (typeof value === 'string') {
        return this.normalizeStableValue(value);
      }
    }
    return undefined;
  }

  private normalizeStableValue(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private normalizeUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    return url.trim();
  }

  private extractImageUrl(
    payload: Record<string, unknown>,
  ): string | undefined {
    const enclosure = payload.enclosure as Record<string, unknown> | undefined;
    if (enclosure && typeof enclosure.url === 'string') {
      const type = enclosure.type as string | undefined;
      if (!type || type.startsWith('image/')) {
        return enclosure.url.trim();
      }
    }

    const mediaContent = payload['media:content'] as
      Record<string, unknown> | Record<string, unknown>[] | undefined;

    if (Array.isArray(mediaContent)) {
      for (const media of mediaContent) {
        const url = this.imageUrlFromMedia(media);
        if (url) return url;
      }
    } else if (mediaContent) {
      const url = this.imageUrlFromMedia(mediaContent);
      if (url) return url;
    }

    const mediaThumbnail = payload['media:thumbnail'] as
      Record<string, unknown> | Record<string, unknown>[] | undefined;

    if (Array.isArray(mediaThumbnail)) {
      for (const thumb of mediaThumbnail) {
        if (typeof thumb.url === 'string') return thumb.url.trim();
      }
    } else if (mediaThumbnail && typeof mediaThumbnail.url === 'string') {
      return mediaThumbnail.url.trim();
    }

    return undefined;
  }

  private imageUrlFromMedia(
    media: Record<string, unknown>,
  ): string | undefined {
    if (typeof media.url !== 'string') return undefined;
    const type = media.type as string | undefined;
    const medium = media.medium as string | undefined;
    if (medium === 'image' || (type && type.startsWith('image/')) || !type) {
      return media.url.trim();
    }
    return undefined;
  }
}
