-- AlterTable
ALTER TABLE "Article" ADD COLUMN "titleFingerprint" TEXT;
ALTER TABLE "Article" ADD COLUMN "canonicalArticleId" TEXT;

-- CreateIndex
CREATE INDEX "Article_titleFingerprint_publishedAt_idx" ON "Article"("titleFingerprint", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_canonicalArticleId_idx" ON "Article"("canonicalArticleId");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_canonicalArticleId_fkey" FOREIGN KEY ("canonicalArticleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
