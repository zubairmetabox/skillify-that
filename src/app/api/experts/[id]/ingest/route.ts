import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runIngestionPipeline, type IngestionConfig } from "@/lib/ingestion/orchestrator";
import { DEFAULT_MODEL } from "@/lib/groq";

type Params = { params: Promise<{ id: string }> };

// POST /api/experts/:id/ingest — start ingestion pipeline
export async function POST(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const expert = await db.expert.findFirst({ where: { id, clerkUserId: userId } });
  if (!expert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check there's something to ingest
  const approvedCount = await db.sourceEndpoint.count({
    where: { expertId: id, complianceStatus: "ALLOWED" },
  });
  if (approvedCount === 0) {
    return NextResponse.json(
      { error: "No approved sources. Set at least one source to ALLOWED first." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const userSettings = await db.userSettings.findUnique({ where: { clerkUserId: userId } });
  const config: IngestionConfig = {
    maxVideos:  Math.min(Math.max(Number(body.maxVideos)  || 20, 5), 100),
    maxPages:   Math.min(Math.max(Number(body.maxPages)   ||  8, 3),  50),
    maxSources: Math.min(Math.max(Number(body.maxSources) || 10, 3),  20),
    model: userSettings?.preferredModel ?? DEFAULT_MODEL,
  };

  // Run async — don't await so the response returns immediately
  runIngestionPipeline(id, config).catch(console.error);

  return NextResponse.json({ ok: true, message: "Ingestion started" });
}

// GET /api/experts/:id/ingest — list ingestion runs + stats
export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const expert = await db.expert.findFirst({ where: { id, clerkUserId: userId } });
  if (!expert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [runs, atomCount, recordCount] = await Promise.all([
    db.ingestionRun.findMany({
      where: { expertId: id },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    db.skillAtom.count({ where: { expertId: id } }),
    db.contentRecord.count({ where: { expertId: id } }),
  ]);

  return NextResponse.json({ runs, atomCount, recordCount });
}
