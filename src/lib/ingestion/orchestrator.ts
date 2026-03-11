import { db } from "@/lib/db";
import { fetchWebPage } from "./web-fetcher";
import { fetchYouTubeChannelContent } from "./youtube-fetcher";
import { fetchRssFeed } from "./rss-fetcher";
import { fetchWebsiteContentPages } from "./sitemap-fetcher";
import { extractAtomsFromChunk, chunkText } from "@/lib/mining/atom-extractor";
import { DEFAULT_MODEL } from "@/lib/groq";
import type { SourceEndpoint } from "@prisma/client";

export type IngestionConfig = {
  maxVideos: number;
  maxPages: number;
  maxSources: number;
  model?: string;
};

const DEFAULT_CONFIG: IngestionConfig = { maxVideos: 20, maxPages: 8, maxSources: 10 };

export async function runIngestionPipeline(
  expertId: string,
  config: IngestionConfig = DEFAULT_CONFIG
): Promise<string> {
  const expert = await db.expert.findUnique({
    where: { id: expertId },
    include: {
      sourceEndpoints: {
        where: { complianceStatus: "ALLOWED" },
        orderBy: { priorityScore: "desc" },
        take: config.maxSources,
      },
    },
  });

  if (!expert) throw new Error("Expert not found");

  const run = await db.ingestionRun.create({
    data: { expertId, status: "RUNNING", log: ["Starting ingestion pipeline..."] },
  });

  const log: string[] = ["Starting ingestion pipeline..."];
  let sourcesProcessed = 0;
  let recordsCreated = 0;
  let atomsExtracted = 0;

  const addLog = async (msg: string) => {
    log.push(msg);
    await db.ingestionRun.update({ where: { id: run.id }, data: { log } });
  };

  try {
    await addLog(`Found ${expert.sourceEndpoints.length} approved sources to ingest`);

    for (const source of expert.sourceEndpoints) {
      await addLog(`Ingesting: ${source.label ?? source.url}`);

      const contents = await fetchContentForSource(source, addLog, config);
      if (contents.length === 0) {
        await addLog(`  → No content extracted from ${source.url}`);
        continue;
      }

      sourcesProcessed++;
      await addLog(`  → ${contents.length} content piece(s) fetched`);

      for (const content of contents) {
        const record = await db.contentRecord.create({
          data: {
            expertId,
            sourceEndpointId: source.id,
            ingestionRunId: run.id,
            title: content.title,
            url: content.url,
            rawText: content.text,
            wordCount: content.wordCount,
            contentType: content.contentType,
            publishedAt: content.publishedAt,
          },
        });

        recordsCreated++;

        const chunks = chunkText(content.text);
        let pageAtoms = 0;

        for (const chunk of chunks) {
          try {
            const atoms = await extractAtomsFromChunk(
              chunk,
              expert.canonicalName,
              expert.domain ?? "",
              content.url,
              config.model ?? DEFAULT_MODEL
            );

            if (atoms.length === 0) continue;

            await db.skillAtom.createMany({
              data: atoms.map((atom) => ({
                expertId,
                contentRecordId: record.id,
                atomType: atom.atomType,
                title: atom.title,
                body: atom.body,
                domain: atom.domain ?? expert.domain ?? null,
                tags: atom.tags ?? [],
                attributionLevel: atom.attributionLevel,
                evidenceStrength: atom.evidenceStrength,
                domainRelevance: atom.domainRelevance,
                sourceUrl: content.url,
                sourceQuote: atom.sourceQuote ?? null,
              })),
            });

            atomsExtracted += atoms.length;
            pageAtoms += atoms.length;
          } catch (chunkErr) {
            // One bad chunk doesn't fail the whole page
            console.error("[ingestion] chunk error:", chunkErr);
          }
        }

        if (pageAtoms > 0) {
          await addLog(`    ✓ "${content.title?.slice(0, 60)}" → ${pageAtoms} atoms`);
        }
      }
    }

    // Deduplicate atoms: same normalized title → keep highest evidence score
    const dupeCount = await deduplicateAtoms(expertId, addLog);
    if (dupeCount > 0) atomsExtracted -= dupeCount;

    await addLog(
      `✓ Done — ${sourcesProcessed} sources, ${recordsCreated} records, ${atomsExtracted} atoms (${dupeCount} duplicates removed)`
    );

    await db.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        sourcesProcessed,
        recordsCreated,
        atomsExtracted,
        completedAt: new Date(),
        log,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await addLog(`✗ Error: ${msg}`);
    await db.ingestionRun.update({
      where: { id: run.id },
      data: { status: "FAILED", completedAt: new Date(), log },
    });
  }

  return run.id;
}

/**
 * Remove near-duplicate atoms for an expert.
 * Normalizes titles (lowercase, strip punctuation), groups them,
 * keeps the atom with the highest evidenceStrength in each group,
 * deletes the rest. Returns the count of deleted atoms.
 */
async function deduplicateAtoms(
  expertId: string,
  addLog: (msg: string) => Promise<void>
): Promise<number> {
  const atoms = await db.skillAtom.findMany({
    where: { expertId },
    select: { id: true, title: true, evidenceStrength: true },
    orderBy: { evidenceStrength: "desc" },
  });

  const groups = new Map<string, { id: string; evidenceStrength: number }[]>();
  for (const atom of atoms) {
    const key = atom.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ id: atom.id, evidenceStrength: atom.evidenceStrength });
  }

  const toDelete: string[] = [];
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    // Already sorted desc by evidenceStrength — keep first, delete rest
    toDelete.push(...group.slice(1).map((a) => a.id));
  }

  if (toDelete.length > 0) {
    await db.skillAtom.deleteMany({ where: { id: { in: toDelete } } });
    await addLog(`  → Removed ${toDelete.length} duplicate atoms`);
  }

  return toDelete.length;
}

async function fetchContentForSource(
  source: SourceEndpoint,
  addLog: (msg: string) => Promise<void>,
  config: IngestionConfig = DEFAULT_CONFIG
) {
  const url = source.url;

  // Detect YouTube by URL regardless of sourceType (catches user-provided URLs)
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    await addLog(`  → YouTube source detected, using Data API`);
    return fetchYouTubeChannelContent(url, config.maxVideos);
  }

  if (source.sourceType === "RSS_FEED" || url.includes("/feed") || url.includes("/rss")) {
    return fetchRssFeed(url, 20);
  }

  if (source.sourceType === "PODCAST") {
    // Apple Podcasts / Spotify don't expose RSS directly — skip
    await addLog(`  → Podcast source skipped (no public RSS found)`);
    return [];
  }

  // For websites: try sitemap first to find content-rich sub-pages
  await addLog(`  → Website source — scanning for content pages via sitemap`);
  const contentPages = await fetchWebsiteContentPages(url, config.maxPages);
  if (contentPages.length > 0) return contentPages;

  // Fallback: just the homepage
  const page = await fetchWebPage(url);
  return page ? [page] : [];
}
