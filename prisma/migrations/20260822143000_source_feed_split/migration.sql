-- CreateEnum
CREATE TYPE "IngestMethod" AS ENUM ('RSS', 'API', 'WEBHOOK', 'SCRAPE');

-- CreateTable
CREATE TABLE "NewsCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "NewsCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsCategory_slug_key" ON "NewsCategory"("slug");

-- AddForeignKey
ALTER TABLE "NewsCategory" ADD CONSTRAINT "NewsCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "NewsCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable Source: publisher metadata (nullable until backfill)
ALTER TABLE "Source" ADD COLUMN "homepageUrl" TEXT;
ALTER TABLE "Source" ADD COLUMN "trustTier" INTEGER NOT NULL DEFAULT 2;

UPDATE "Source"
SET "homepageUrl" = COALESCE(
  NULLIF(substring("feedUrl" FROM '^(https?://[^/]+)'), ''),
  "feedUrl"
);

UPDATE "Source"
SET "trustTier" = CASE
  WHEN "type" IN ('GOVERNMENT', 'MUNICIPAL') THEN 1
  WHEN "type" = 'NEWS' THEN 2
  ELSE 3
END;

ALTER TABLE "Source" ALTER COLUMN "homepageUrl" SET NOT NULL;

-- CreateTable SourceFeed
CREATE TABLE "SourceFeed" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ingestMethod" "IngestMethod" NOT NULL DEFAULT 'RSS',
    "language" TEXT NOT NULL DEFAULT 'en',
    "categoryId" TEXT,
    "rawCategoryLabel" TEXT,
    "fetchIntervalSeconds" INTEGER NOT NULL DEFAULT 900,
    "lastFetchedAt" TIMESTAMP(3),
    "lastEtag" TEXT,
    "lastModifiedHeader" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastStatus" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceFeed_pkey" PRIMARY KEY ("id")
);

-- Backfill: one SourceFeed per existing Source
INSERT INTO "SourceFeed" (
    "id",
    "sourceId",
    "url",
    "ingestMethod",
    "language",
    "fetchIntervalSeconds",
    "lastFetchedAt",
    "isActive",
    "consecutiveFailures",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    s."id",
    s."feedUrl",
    'RSS'::"IngestMethod",
    'en',
    900,
    s."lastFetchedAt",
    s."isActive",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Source" s;

-- CreateIndex SourceFeed
CREATE UNIQUE INDEX "SourceFeed_url_key" ON "SourceFeed"("url");
CREATE INDEX "SourceFeed_isActive_fetchIntervalSeconds_idx" ON "SourceFeed"("isActive", "fetchIntervalSeconds");

-- AddForeignKey SourceFeed
ALTER TABLE "SourceFeed" ADD CONSTRAINT "SourceFeed_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SourceFeed" ADD CONSTRAINT "SourceFeed_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "NewsCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Remap RawArticle from sourceId to sourceFeedId
ALTER TABLE "RawArticle" ADD COLUMN "sourceFeedId" TEXT;

UPDATE "RawArticle" ra
SET "sourceFeedId" = sf."id"
FROM "SourceFeed" sf
WHERE sf."sourceId" = ra."sourceId";

ALTER TABLE "RawArticle" ALTER COLUMN "sourceFeedId" SET NOT NULL;

ALTER TABLE "RawArticle" DROP CONSTRAINT "RawArticle_sourceId_fkey";
DROP INDEX "RawArticle_sourceId_fetchedAt_idx";
DROP INDEX "RawArticle_sourceId_externalId_key";
ALTER TABLE "RawArticle" DROP COLUMN "sourceId";

CREATE UNIQUE INDEX "RawArticle_sourceFeedId_externalId_key" ON "RawArticle"("sourceFeedId", "externalId");
CREATE INDEX "RawArticle_sourceFeedId_fetchedAt_idx" ON "RawArticle"("sourceFeedId", "fetchedAt");

ALTER TABLE "RawArticle" ADD CONSTRAINT "RawArticle_sourceFeedId_fkey" FOREIGN KEY ("sourceFeedId") REFERENCES "SourceFeed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Article: canonical category FK; free-text category was unused
ALTER TABLE "Article" ADD COLUMN "categoryId" TEXT;
CREATE INDEX "Article_categoryId_idx" ON "Article"("categoryId");
ALTER TABLE "Article" ADD CONSTRAINT "Article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "NewsCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Article" DROP COLUMN "category";

-- Drop Source feed-level columns (now on SourceFeed)
ALTER TABLE "Source" DROP COLUMN "feedUrl";
ALTER TABLE "Source" DROP COLUMN "lastFetchedAt";
