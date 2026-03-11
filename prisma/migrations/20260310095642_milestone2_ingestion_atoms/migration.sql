-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AtomType" AS ENUM ('PRINCIPLE', 'TACTIC', 'SCRIPT', 'FRAMEWORK', 'DIAGNOSTIC', 'OBJECTION_RESPONSE', 'WORKFLOW', 'INSIGHT');

-- CreateEnum
CREATE TYPE "AttributionLevel" AS ENUM ('L1_DIRECT', 'L2_FIRST_PARTY', 'L3_SECONDARY');

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'RUNNING',
    "sourcesProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "atomsExtracted" INTEGER NOT NULL DEFAULT 0,
    "log" TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentRecord" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "sourceEndpointId" TEXT NOT NULL,
    "ingestionRunId" TEXT,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "contentType" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillAtom" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "contentRecordId" TEXT NOT NULL,
    "atomType" "AtomType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "domain" TEXT,
    "tags" TEXT[],
    "attributionLevel" "AttributionLevel" NOT NULL,
    "evidenceStrength" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "domainRelevance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sourceUrl" TEXT NOT NULL,
    "sourceQuote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillAtom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngestionRun_expertId_idx" ON "IngestionRun"("expertId");

-- CreateIndex
CREATE INDEX "ContentRecord_expertId_idx" ON "ContentRecord"("expertId");

-- CreateIndex
CREATE INDEX "ContentRecord_sourceEndpointId_idx" ON "ContentRecord"("sourceEndpointId");

-- CreateIndex
CREATE INDEX "SkillAtom_expertId_idx" ON "SkillAtom"("expertId");

-- CreateIndex
CREATE INDEX "SkillAtom_contentRecordId_idx" ON "SkillAtom"("contentRecordId");

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRecord" ADD CONSTRAINT "ContentRecord_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRecord" ADD CONSTRAINT "ContentRecord_sourceEndpointId_fkey" FOREIGN KEY ("sourceEndpointId") REFERENCES "SourceEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRecord" ADD CONSTRAINT "ContentRecord_ingestionRunId_fkey" FOREIGN KEY ("ingestionRunId") REFERENCES "IngestionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillAtom" ADD CONSTRAINT "SkillAtom_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillAtom" ADD CONSTRAINT "SkillAtom_contentRecordId_fkey" FOREIGN KEY ("contentRecordId") REFERENCES "ContentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
