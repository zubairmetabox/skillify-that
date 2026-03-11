import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildAtlas } from "@/lib/atlas/orchestrator";
import { DEFAULT_MODEL } from "@/lib/groq";

type Params = { params: Promise<{ id: string }> };

// POST — kick off atlas build (fresh or resume)
export async function POST(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const expert = await db.expert.findFirst({ where: { id, clerkUserId: userId } });
  if (!expert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const atomCount = await db.skillAtom.count({ where: { expertId: id } });
  if (atomCount === 0) {
    return NextResponse.json({ error: "No skill atoms. Run ingestion first." }, { status: 400 });
  }

  let resume = false;
  try {
    const body = await req.json().catch(() => ({}));
    resume = Boolean(body.resume);
  } catch {
    // no-op
  }

  const userSettings = await db.userSettings.findUnique({ where: { clerkUserId: userId } });
  const model = userSettings?.preferredModel ?? DEFAULT_MODEL;

  buildAtlas(id, { resume, model }).catch(console.error);

  return NextResponse.json({ ok: true, resume });
}

// GET — latest atlas for this expert (includes buildStatus + buildLog for live progress)
export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const expert = await db.expert.findFirst({ where: { id, clerkUserId: userId } });
  if (!expert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const atlas = await db.skillAtlas.findFirst({
      where: { expertId: id },
      orderBy: { createdAt: "desc" },
      include: {
        clusters: { include: { packages: true }, orderBy: { atomCount: "desc" } },
        packages: { orderBy: { coverageScore: "desc" } },
      },
    });
    return NextResponse.json({ atlas });
  } catch (err) {
    console.error("[build-atlas GET]", err);
    return NextResponse.json({ error: "Failed to load atlas", atlas: null }, { status: 500 });
  }
}
