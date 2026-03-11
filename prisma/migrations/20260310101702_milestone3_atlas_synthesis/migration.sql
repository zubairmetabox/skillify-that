-- CreateEnum
CREATE TYPE "ReleaseState" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'DEPRECATED');

-- AlterTable
ALTER TABLE "SkillAtom" ADD COLUMN     "clusterId" TEXT;

-- CreateTable
CREATE TABLE "SkillAtlas" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "atomCount" INTEGER NOT NULL DEFAULT 0,
    "clusterCount" INTEGER NOT NULL DEFAULT 0,
    "packageCount" INTEGER NOT NULL DEFAULT 0,
    "gaps" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillAtlas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillCluster" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "atlasId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT,
    "atomCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillPackage" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "atlasId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "examples" JSONB NOT NULL,
    "antiPatterns" JSONB NOT NULL,
    "evidenceSummary" TEXT NOT NULL,
    "releaseState" "ReleaseState" NOT NULL DEFAULT 'DRAFT',
    "coverageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkillAtlas_expertId_idx" ON "SkillAtlas"("expertId");

-- CreateIndex
CREATE INDEX "SkillCluster_expertId_idx" ON "SkillCluster"("expertId");

-- CreateIndex
CREATE INDEX "SkillCluster_atlasId_idx" ON "SkillCluster"("atlasId");

-- CreateIndex
CREATE INDEX "SkillPackage_expertId_idx" ON "SkillPackage"("expertId");

-- CreateIndex
CREATE INDEX "SkillPackage_clusterId_idx" ON "SkillPackage"("clusterId");

-- CreateIndex
CREATE INDEX "SkillPackage_atlasId_idx" ON "SkillPackage"("atlasId");

-- CreateIndex
CREATE INDEX "SkillAtom_clusterId_idx" ON "SkillAtom"("clusterId");

-- AddForeignKey
ALTER TABLE "SkillAtom" ADD CONSTRAINT "SkillAtom_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SkillCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillAtlas" ADD CONSTRAINT "SkillAtlas_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCluster" ADD CONSTRAINT "SkillCluster_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCluster" ADD CONSTRAINT "SkillCluster_atlasId_fkey" FOREIGN KEY ("atlasId") REFERENCES "SkillAtlas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPackage" ADD CONSTRAINT "SkillPackage_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPackage" ADD CONSTRAINT "SkillPackage_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SkillCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPackage" ADD CONSTRAINT "SkillPackage_atlasId_fkey" FOREIGN KEY ("atlasId") REFERENCES "SkillAtlas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
