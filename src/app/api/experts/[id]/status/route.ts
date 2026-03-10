import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const expert = await db.expert.findUnique({
    where: { id },
    include: {
      aliases: true,
      sourceEndpoints: {
        include: { policyProfile: true },
        orderBy: { priorityScore: "desc" },
      },
      discoveryRuns: {
        orderBy: { startedAt: "desc" },
        take: 3,
      },
    },
  });

  if (!expert) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (expert.clerkUserId !== userId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const latestRun = expert.discoveryRuns[0];
  const sourceSummary = {
    total: expert.sourceEndpoints.length,
    allowed: expert.sourceEndpoints.filter((s) => s.complianceStatus === "ALLOWED").length,
    disallowed: expert.sourceEndpoints.filter((s) => s.complianceStatus === "DISALLOWED").length,
    pending: expert.sourceEndpoints.filter((s) => s.complianceStatus === "PENDING").length,
    byTier: {
      OFFICIAL: expert.sourceEndpoints.filter((s) => s.tier === "OFFICIAL").length,
      FIRST_PARTY: expert.sourceEndpoints.filter((s) => s.tier === "FIRST_PARTY").length,
      SECONDARY: expert.sourceEndpoints.filter((s) => s.tier === "SECONDARY").length,
      TERTIARY: expert.sourceEndpoints.filter((s) => s.tier === "TERTIARY").length,
    },
  };

  return NextResponse.json({ expert, latestRun, sourceSummary });
}
