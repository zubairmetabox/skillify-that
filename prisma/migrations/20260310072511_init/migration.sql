-- CreateEnum
CREATE TYPE "ExpertStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('YOUTUBE_CHANNEL', 'YOUTUBE_VIDEO', 'WEBSITE', 'BLOG', 'RSS_FEED', 'PODCAST', 'COURSE_PORTAL', 'SOCIAL_PROFILE', 'BOOK', 'OTHER');

-- CreateEnum
CREATE TYPE "SourceTier" AS ENUM ('OFFICIAL', 'FIRST_PARTY', 'SECONDARY', 'TERTIARY');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('PENDING', 'ALLOWED', 'DISALLOWED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "DiscoveryStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Expert" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "domain" TEXT,
    "bio" TEXT,
    "status" "ExpertStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertAlias" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "context" TEXT,

    CONSTRAINT "ExpertAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceEndpoint" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "sourceType" "SourceType" NOT NULL,
    "tier" "SourceTier" NOT NULL DEFAULT 'SECONDARY',
    "authorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'PENDING',
    "complianceNote" TEXT,
    "robotsChecked" BOOLEAN NOT NULL DEFAULT false,
    "robotsAllowed" BOOLEAN,
    "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcePolicyProfile" (
    "id" TEXT NOT NULL,
    "sourceEndpointId" TEXT NOT NULL,
    "apiAvailable" BOOLEAN NOT NULL DEFAULT false,
    "apiName" TEXT,
    "robotsTxtUrl" TEXT,
    "robotsDisallow" TEXT[],
    "rateLimit" TEXT,
    "licenseType" TEXT,
    "contentRetention" TEXT,
    "notes" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourcePolicyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryRun" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "status" "DiscoveryStatus" NOT NULL DEFAULT 'RUNNING',
    "sourcesFound" INTEGER NOT NULL DEFAULT 0,
    "log" TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expert_clerkUserId_idx" ON "Expert"("clerkUserId");

-- CreateIndex
CREATE INDEX "ExpertAlias_expertId_idx" ON "ExpertAlias"("expertId");

-- CreateIndex
CREATE INDEX "SourceEndpoint_expertId_idx" ON "SourceEndpoint"("expertId");

-- CreateIndex
CREATE UNIQUE INDEX "SourcePolicyProfile_sourceEndpointId_key" ON "SourcePolicyProfile"("sourceEndpointId");

-- CreateIndex
CREATE INDEX "DiscoveryRun_expertId_idx" ON "DiscoveryRun"("expertId");

-- AddForeignKey
ALTER TABLE "ExpertAlias" ADD CONSTRAINT "ExpertAlias_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEndpoint" ADD CONSTRAINT "SourceEndpoint_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePolicyProfile" ADD CONSTRAINT "SourcePolicyProfile_sourceEndpointId_fkey" FOREIGN KEY ("sourceEndpointId") REFERENCES "SourceEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
