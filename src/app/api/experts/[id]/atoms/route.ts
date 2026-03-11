import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// GET /api/experts/:id/atoms — list skill atoms with optional filters
export async function GET(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const expert = await db.expert.findFirst({ where: { id, clerkUserId: userId } });
  if (!expert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const atomType = url.searchParams.get("type") ?? undefined;
  const domain = url.searchParams.get("domain") ?? undefined;
  const take = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);

  const atoms = await db.skillAtom.findMany({
    where: {
      expertId: id,
      ...(atomType ? { atomType: atomType as never } : {}),
      ...(domain ? { domain } : {}),
    },
    orderBy: [{ domainRelevance: "desc" }, { evidenceStrength: "desc" }],
    take,
    include: { contentRecord: { select: { title: true, url: true, contentType: true } } },
  });

  return NextResponse.json({ atoms });
}
