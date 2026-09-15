-- AlterTable
ALTER TABLE "UserLocation" DROP COLUMN "adminArea",
ADD COLUMN     "administrativeAreaLevel1" TEXT,
ADD COLUMN     "administrativeAreaLevel2" TEXT,
ADD COLUMN     "administrativeAreaLevel3" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "premise" TEXT,
ADD COLUMN     "sublocalityLevel1" TEXT,
ADD COLUMN     "sublocalityLevel2" TEXT,
ADD COLUMN     "sublocalityLevel3" TEXT;
