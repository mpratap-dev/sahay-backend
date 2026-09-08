-- CreateEnum
CREATE TYPE "LocationKind" AS ENUM ('CURRENT', 'HOMETOWN');

-- CreateEnum
CREATE TYPE "InterestArea" AS ENUM (
  'TECHNOLOGY_SCIENCE_ENGINEERING',
  'BUSINESS_FINANCE_ENTREPRENEURSHIP',
  'LAW_GOVERNMENT_PUBLIC_SERVICES',
  'EDUCATION_HEALTHCARE_MEDIA_LIFESTYLE'
);

-- CreateEnum
CREATE TYPE "UserInterestStatus" AS ENUM ('FOLLOWED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "UserInterestSource" AS ENUM ('MANUAL', 'ONBOARDING', 'AI_RECOMMENDATION');

-- CreateTable
CREATE TABLE "UserLocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "LocationKind" NOT NULL,
    "latitude" DECIMAL(65,30) NOT NULL,
    "longitude" DECIMAL(65,30) NOT NULL,
    "locality" TEXT,
    "adminArea" TEXT,
    "countryCode" TEXT,
    "postalCode" TEXT,
    "placeId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInterestArea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "area" "InterestArea" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInterestArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" "UserInterestStatus" NOT NULL,
    "source" "UserInterestSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterestAreaTopic" (
    "id" TEXT NOT NULL,
    "area" "InterestArea" NOT NULL,
    "topicId" TEXT NOT NULL,

    CONSTRAINT "InterestAreaTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserLocation_userId_kind_key" ON "UserLocation"("userId", "kind");

-- CreateIndex
CREATE INDEX "UserInterestArea_userId_idx" ON "UserInterestArea"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInterestArea_userId_area_key" ON "UserInterestArea"("userId", "area");

-- CreateIndex
CREATE INDEX "UserInterest_userId_status_idx" ON "UserInterest"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserInterest_userId_topicId_key" ON "UserInterest"("userId", "topicId");

-- CreateIndex
CREATE INDEX "InterestAreaTopic_area_idx" ON "InterestAreaTopic"("area");

-- CreateIndex
CREATE UNIQUE INDEX "InterestAreaTopic_area_topicId_key" ON "InterestAreaTopic"("area", "topicId");

-- AddForeignKey
ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInterestArea" ADD CONSTRAINT "UserInterestArea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInterest" ADD CONSTRAINT "UserInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInterest" ADD CONSTRAINT "UserInterest_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestAreaTopic" ADD CONSTRAINT "InterestAreaTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
