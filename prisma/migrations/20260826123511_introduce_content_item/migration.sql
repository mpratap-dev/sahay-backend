-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('NEWS', 'GOVERNMENT', 'MUNICIPAL', 'TRAFFIC', 'WEATHER', 'SOCIAL', 'CITIZEN');

-- CreateEnum
CREATE TYPE "IngestMethod" AS ENUM ('RSS', 'API', 'WEBHOOK', 'SCRAPE');

-- CreateEnum
CREATE TYPE "ArticleTopicSource" AS ENUM ('FEED_CATEGORY', 'EXTRACTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('NEWS_ARTICLE', 'CIVIC_ISSUE', 'ALERT');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('PUBLISHED', 'DRAFT', 'ARCHIVED', 'FLAGGED');

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "homepageUrl" TEXT NOT NULL,
    "trustTier" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "NewsCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "NewsCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleTopic" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "source" "ArticleTopicSource" NOT NULL DEFAULT 'FEED_CATEGORY',
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawArticle" (
    "id" TEXT NOT NULL,
    "sourceFeedId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "type" "ContentType" NOT NULL DEFAULT 'NEWS_ARTICLE',
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "languageConfidence" DOUBLE PRECISION,
    "publishedAt" TIMESTAMP(3),
    "categoryId" TEXT,
    "entities" JSONB,
    "urgency" TEXT,
    "confidence" DOUBLE PRECISION,
    "titleFingerprint" TEXT,
    "canonicalContentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "rawArticleId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imageUrl" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_name_key" ON "Source"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Source_slug_key" ON "Source"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SourceFeed_url_key" ON "SourceFeed"("url");

-- CreateIndex
CREATE INDEX "SourceFeed_isActive_fetchIntervalSeconds_idx" ON "SourceFeed"("isActive", "fetchIntervalSeconds");

-- CreateIndex
CREATE UNIQUE INDEX "NewsCategory_slug_key" ON "NewsCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "ArticleTopic_topicId_articleId_idx" ON "ArticleTopic"("topicId", "articleId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleTopic_articleId_topicId_key" ON "ArticleTopic"("articleId", "topicId");

-- CreateIndex
CREATE INDEX "RawArticle_processed_idx" ON "RawArticle"("processed");

-- CreateIndex
CREATE INDEX "RawArticle_sourceFeedId_fetchedAt_idx" ON "RawArticle"("sourceFeedId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RawArticle_sourceFeedId_externalId_key" ON "RawArticle"("sourceFeedId", "externalId");

-- CreateIndex
CREATE INDEX "ContentItem_status_type_publishedAt_idx" ON "ContentItem"("status", "type", "publishedAt");

-- CreateIndex
CREATE INDEX "ContentItem_categoryId_idx" ON "ContentItem"("categoryId");

-- CreateIndex
CREATE INDEX "ContentItem_titleFingerprint_publishedAt_idx" ON "ContentItem"("titleFingerprint", "publishedAt");

-- CreateIndex
CREATE INDEX "ContentItem_canonicalContentId_idx" ON "ContentItem"("canonicalContentId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_contentItemId_key" ON "Article"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_rawArticleId_key" ON "Article"("rawArticleId");

-- CreateIndex
CREATE INDEX "Article_sourceId_idx" ON "Article"("sourceId");

-- AddForeignKey
ALTER TABLE "SourceFeed" ADD CONSTRAINT "SourceFeed_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFeed" ADD CONSTRAINT "SourceFeed_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "NewsCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsCategory" ADD CONSTRAINT "NewsCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "NewsCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTopic" ADD CONSTRAINT "ArticleTopic_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTopic" ADD CONSTRAINT "ArticleTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawArticle" ADD CONSTRAINT "RawArticle_sourceFeedId_fkey" FOREIGN KEY ("sourceFeedId") REFERENCES "SourceFeed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "NewsCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_canonicalContentId_fkey" FOREIGN KEY ("canonicalContentId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_rawArticleId_fkey" FOREIGN KEY ("rawArticleId") REFERENCES "RawArticle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial index for the hot published feed query path
CREATE INDEX content_item_published_feed_idx
ON "ContentItem" (type, "publishedAt" DESC, id DESC)
WHERE status = 'PUBLISHED';
