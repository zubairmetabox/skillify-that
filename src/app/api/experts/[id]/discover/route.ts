import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runDiscovery } from "@/lib/discovery/orchestrator";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const expert = await db.expert.findUnique({ where: { id } });
  if (!expert) return NextResponse.json({ error: "Expert not found" }, { status: 404 });
  if (expert.clerkUserId !== userId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Check if a discovery is already running
  const activeRun = await db.discoveryRun.findFirst({
    where: { expertId: id, status: "RUNNING" },
  });
  if (activeRun) {
    return NextResponse.json(
      { error: "A discovery run is already in progress", runId: activeRun.id },
      { status: 409 }
    );
  }

  // Run discovery async — respond immediately with run ID
  // We use a non-blocking fire-and-forget pattern so the client can poll status
  const runPromise = runDiscovery(id).catch(console.error);
  void runPromise;

  // Wait briefly to get the new run ID that was created by the orchestrator
  await new Promise((r) => setTimeout(r, 800));

  const latestRun = await db.discoveryRun.findFirst({
    where: { expertId: id },
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json({
    message: "Discovery started",
    runId: latestRun?.id,
    expertId: id,
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const expert = await db.expert.findUnique({ where: { id } });
  if (!expert) return NextResponse.json({ error: "Expert not found" }, { status: 404 });
  if (expert.clerkUserId !== userId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const runs = await db.discoveryRun.findMany({
    where: { expertId: id },
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json({ runs });
}
