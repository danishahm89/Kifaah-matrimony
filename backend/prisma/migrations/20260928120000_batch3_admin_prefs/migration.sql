-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "state" TEXT,
ADD COLUMN     "motherTongue" TEXT,
ADD COLUMN     "education" TEXT,
ADD COLUMN     "profession" TEXT,
ADD COLUMN     "prefMinAge" INTEGER,
ADD COLUMN     "prefMaxAge" INTEGER,
ADD COLUMN     "prefState" TEXT,
ADD COLUMN     "prefSect" TEXT,
ADD COLUMN     "prefMarital" TEXT;

-- CreateIndex
CREATE INDEX "Profile_state_idx" ON "Profile"("state");

-- CreateIndex
CREATE INDEX "Profile_age_idx" ON "Profile"("age");
