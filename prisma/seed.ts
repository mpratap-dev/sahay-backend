import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { SourceType } from '../src/generated/prisma/enums';
import type { InterestArea } from '../src/generated/prisma/enums';
import { TOPIC_SEED } from '../src/ingestion/topic-mapping';
import { INTEREST_AREA_TOPIC_SLUGS } from '../src/personalization/interest-areas';
import { createPrismaClient } from '../src/prisma/create-prisma-pg-adapter';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}
const prisma = createPrismaClient(databaseUrl);
const FEEDS_DIR = path.join(__dirname, '..', 'data', 'feeds');

type FeedSourceFile = {
  name: string;
  slug: string;
  homepageUrl: string;
  trustTier?: number;
  urls: string[];
};

function rawCategoryLabelFromUrl(url: string): string | null {
  const { pathname } = new URL(url);
  const segments = pathname.split('/').filter(Boolean);
  const ignored = new Set([
    'rss',
    'feed',
    'feeder',
    'default.rss',
    'videos-rss-feed',
  ]);
  const parts: string[] = [];

  for (const segment of segments) {
    if (ignored.has(segment)) {
      continue;
    }
    if (segment.endsWith('.xml')) {
      parts.push(segment.slice(0, -'.xml'.length));
      continue;
    }
    parts.push(segment);
  }

  return parts.length > 0 ? parts.join('/') : null;
}

async function loadFeedSourceFiles(): Promise<FeedSourceFile[]> {
  const entries = await readdir(FEEDS_DIR);
  const files = entries.filter((file) => file.endsWith('.json'));
  const sources: FeedSourceFile[] = [];

  for (const file of files) {
    const raw = await readFile(path.join(FEEDS_DIR, file), 'utf8');
    sources.push(JSON.parse(raw) as FeedSourceFile);
  }

  return sources;
}

async function upsertTopics() {
  for (const topic of TOPIC_SEED) {
    await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: { name: topic.name },
      create: { slug: topic.slug, name: topic.name },
    });
  }
  console.log(`Seeded ${TOPIC_SEED.length} topics`);
}

async function upsertInterestAreaTopics() {
  let count = 0;
  for (const [area, slugs] of Object.entries(INTEREST_AREA_TOPIC_SLUGS)) {
    for (const slug of slugs) {
      const topic = await prisma.topic.findUnique({ where: { slug } });
      if (!topic) {
        throw new Error(
          `Cannot map interest area ${area}: missing topic ${slug}`,
        );
      }
      await prisma.interestAreaTopic.upsert({
        where: {
          area_topicId: {
            area: area as InterestArea,
            topicId: topic.id,
          },
        },
        update: {},
        create: { area: area as InterestArea, topicId: topic.id },
      });
      count += 1;
    }
  }
  console.log(`Seeded ${count} interest-area topic mappings`);
}

async function upsertFeeds(sourceId: string, urls: string[]) {
  const urlSet = new Set(urls);

  for (const url of urls) {
    await prisma.sourceFeed.upsert({
      where: { url },
      update: {
        sourceId,
        isActive: true,
        language: 'en',
        rawCategoryLabel: rawCategoryLabelFromUrl(url),
      },
      create: {
        sourceId,
        url,
        language: 'en',
        rawCategoryLabel: rawCategoryLabelFromUrl(url),
      },
    });
  }

  const deactivated = await prisma.sourceFeed.updateMany({
    where: {
      sourceId,
      url: { notIn: [...urlSet] },
      isActive: true,
    },
    data: { isActive: false },
  });

  if (deactivated.count > 0) {
    console.log(`Deactivated ${deactivated.count} orphaned feeds for source`);
  }
}

async function main() {
  await upsertTopics();
  await upsertInterestAreaTopics();

  const feedSources = await loadFeedSourceFiles();

  for (const feedSource of feedSources) {
    const source = await prisma.source.upsert({
      where: { slug: feedSource.slug },
      update: {
        name: feedSource.name,
        homepageUrl: feedSource.homepageUrl,
        trustTier: feedSource.trustTier ?? 2,
        isActive: true,
      },
      create: {
        name: feedSource.name,
        slug: feedSource.slug,
        type: SourceType.NEWS,
        homepageUrl: feedSource.homepageUrl,
        trustTier: feedSource.trustTier ?? 2,
      },
    });

    await upsertFeeds(source.id, feedSource.urls);
    console.log(`Seeded ${feedSource.name} (${feedSource.urls.length} feeds)`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
