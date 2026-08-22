import 'dotenv/config';
import { SourceType } from '../src/generated/prisma/enums';
import { createPrismaClient } from '../src/prisma/create-prisma-pg-adapter';

const prisma = createPrismaClient(process.env.DATABASE_URL!);

async function main() {
  await prisma.source.upsert({
    where: {
      slug: 'the-hindu-delhi',
    },
    update: {
      feedUrl: 'https://www.thehindu.com/news/cities/Delhi/feeder/default.rss',
      isActive: true,
    },
    create: {
      name: 'The Hindu - Delhi',
      slug: 'the-hindu-delhi',
      type: SourceType.NEWS,
      feedUrl: 'https://www.thehindu.com/news/cities/Delhi/feeder/default.rss',
    },
  });

  console.log('Seeded The Hindu - Delhi source');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
