import 'dotenv/config';
import { SourceType } from '../src/generated/prisma/enums';
import { createPrismaClient } from '../src/prisma/create-prisma-pg-adapter';

const prisma = createPrismaClient(process.env.DATABASE_URL!);

const HINDU_FEED_URL =
  'https://www.thehindu.com/news/cities/Delhi/feeder/default.rss';

async function main() {
  const source = await prisma.source.upsert({
    where: {
      slug: 'the-hindu-delhi',
    },
    update: {
      homepageUrl: 'https://www.thehindu.com',
      trustTier: 2,
      isActive: true,
    },
    create: {
      name: 'The Hindu - Delhi',
      slug: 'the-hindu-delhi',
      type: SourceType.NEWS,
      homepageUrl: 'https://www.thehindu.com',
      trustTier: 2,
    },
  });

  await prisma.sourceFeed.upsert({
    where: { url: HINDU_FEED_URL },
    update: {
      isActive: true,
      sourceId: source.id,
    },
    create: {
      sourceId: source.id,
      url: HINDU_FEED_URL,
      language: 'en',
    },
  });

  console.log('Seeded The Hindu - Delhi source and feed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
