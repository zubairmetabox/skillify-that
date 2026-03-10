import { db } from "@/lib/db";
import { resolveExpertIdentity } from "./groq-identity";
import { discoverYouTubeSources } from "./youtube";
import { discoverWebSources } from "./web";
import { checkRobotsTxt } from "./robots";
import { DiscoveredSource } from "@/types";
import { SourceType, SourceTier, ComplianceStatus } from "@prisma/client";

/**
 * Main discovery orchestrator for Milestone 1.
 * 1. Resolves expert identity via Groq
 * 2. Discovers YouTube sources
 * 3. Discovers web sources
 * 4. Checks robots.txt compliance per source
 * 5. Scores and ranks sources
 * 6. Persists results to DB
 */
export async function runDiscovery(expertId: string): Promise<void> {
  const expert = await db.expert.findUniqueOrThrow({
    where: { id: expertId },
    include: { aliases: true },
  });

  // Create a run record
  const run = await db.discoveryRun.create({
    data: {
      expertId,
      status: "RUNNING",
      log: [`[${new Date().toISOString()}] Discovery started for: ${expert.canonicalName}`],
    },
  });

  const appendLog = (msg: string) =>
    db.discoveryRun.update({
      where: { id: run.id },
      data: { log: { push: `[${new Date().toISOString()}] ${msg}` } },
    });

  try {
    // Phase A: Identity resolution
    await appendLog("Phase A: Resolving expert identity via Groq...");
    const identity = await resolveExpertIdentity(
      expert.canonicalName,
      expert.domain ?? "general"
    );
    await appendLog(`Resolved: aliases=${identity.aliases.length}, websites=${identity.likelyWebsites.length}`);

    // Persist any new aliases
    for (const alias of identity.aliases) {
      await db.expertAlias.upsert({
        where: {
          // pseudo-unique: we'll just create if not duplicate
          id: `${expertId}-${alias}`.slice(0, 25),
        },
        create: { expertId, alias, context: "groq-resolved" },
        update: {},
      }).catch(() =>
        db.expertAlias.create({ data: { expertId, alias, context: "groq-resolved" } }).catch(() => null)
      );
    }

    // Phase B: Source discovery
    await appendLog("Phase B: Discovering YouTube sources...");
    const ytSources = await discoverYouTubeSources(
      expert.canonicalName,
      expert.domain ?? "general"
    );
    await appendLog(`YouTube: found ${ytSources.length} sources`);

    await appendLog("Phase B: Discovering web sources...");
    const webSources = await discoverWebSources(
      expert.canonicalName,
      expert.domain ?? "general",
      identity.likelyWebsites
    );
    await appendLog(`Web: found ${webSources.length} sources`);

    // Merge all sources
    const allSources: DiscoveredSource[] = [...ytSources, ...webSources];

    // Add RSS/podcast hints from identity resolution
    for (const podcast of identity.likelyPodcasts) {
      allSources.push({
        url: `https://podcasts.apple.com/search?term=${encodeURIComponent(podcast)}`,
        label: `Podcast: ${podcast}`,
        sourceType: "PODCAST",
        tier: "FIRST_PARTY",
        authorityScore: 0.7,
        relevanceScore: 0.75,
        priorityScore: 0.7,
        complianceStatus: "PENDING",
        complianceNote: "Manual verification required for podcast feed URL",
      });
    }

    // Phase C: Compliance gate — robots check for web sources
    await appendLog("Phase C: Running compliance gate...");
    for (const source of allSources) {
      if (source.sourceType === "WEBSITE" || source.sourceType === "BLOG") {
        const robots = await checkRobotsTxt(source.url);
        source.robotsAllowed = robots.allowed;
        source.complianceStatus = robots.allowed ? "ALLOWED" : "DISALLOWED";
        source.complianceNote = robots.allowed
          ? "robots.txt permits access"
          : `robots.txt disallows: ${robots.disallowedPaths.join(", ")}`;
      }
    }

    // Rank sources by priority score descending
    const ranked = allSources.sort((a, b) => b.priorityScore - a.priorityScore);
    await appendLog(`Phase C done. ${ranked.length} total sources ranked.`);

    // Persist source endpoints
    for (const src of ranked) {
      await db.sourceEndpoint.upsert({
        where: {
          // Use url+expertId as logical unique key
          id: [expertId, src.url].join("-").slice(0, 25),
        },
        create: {
          expertId,
          url: src.url,
          label: src.label,
          sourceType: src.sourceType as SourceType,
          tier: src.tier as SourceTier,
          authorityScore: src.authorityScore,
          relevanceScore: src.relevanceScore,
          priorityScore: src.priorityScore,
          complianceStatus: src.complianceStatus as ComplianceStatus,
          complianceNote: src.complianceNote,
          robotsChecked: src.robotsAllowed !== undefined,
          robotsAllowed: src.robotsAllowed,
        },
        update: {
          priorityScore: src.priorityScore,
          complianceStatus: src.complianceStatus as ComplianceStatus,
          complianceNote: src.complianceNote,
          robotsChecked: src.robotsAllowed !== undefined,
          robotsAllowed: src.robotsAllowed,
          updatedAt: new Date(),
        },
      }).catch(async () => {
        // fallback: create without upsert on ID conflict
        await db.sourceEndpoint.create({
          data: {
            expertId,
            url: src.url,
            label: src.label,
            sourceType: src.sourceType as SourceType,
            tier: src.tier as SourceTier,
            authorityScore: src.authorityScore,
            relevanceScore: src.relevanceScore,
            priorityScore: src.priorityScore,
            complianceStatus: src.complianceStatus as ComplianceStatus,
            complianceNote: src.complianceNote,
            robotsChecked: src.robotsAllowed !== undefined,
            robotsAllowed: src.robotsAllowed,
          },
        }).catch(() => null);
      });
    }

    // Finalize run
    await db.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        sourcesFound: ranked.length,
        completedAt: new Date(),
        log: { push: `[${new Date().toISOString()}] Discovery completed. ${ranked.length} sources found.` },
      },
    });
  } catch (err) {
    await db.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        log: { push: `[${new Date().toISOString()}] ERROR: ${String(err)}` },
      },
    });
    throw err;
  }
}
