import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const createExpertSchema = z.object({
  canonicalName: z.string().min(2).max(120),
  domain: z.string().min(1).max(80).optional(),
  bio: z.string().max(1000).optional(),
  aliases: z.array(z.string().min(1)).optional(),
  knownUrls: z.array(z.string().url()).optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createExpertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const { canonicalName, domain, bio, aliases = [], knownUrls = [] } = parsed.data;

  const expert = await db.expert.create({
    data: {
      clerkUserId: userId,
      canonicalName,
      domain,
      bio,
      aliases: {
        create: aliases.map((alias) => ({ alias, context: "user-provided" })),
      },
      sourceEndpoints: {
        create: knownUrls.map((url) => ({
          url,
          label: `User-provided: ${new URL(url).host}`,
          sourceType: "WEBSITE" as const,
          tier: "OFFICIAL" as const,
          authorityScore: 0.95,
          relevanceScore: 0.8,
          priorityScore: 0.9,
          complianceStatus: "PENDING" as const,
          complianceNote: "Provided by user — pending compliance check",
        })),
      },
    },
    include: { aliases: true, sourceEndpoints: true },
  });

  return NextResponse.json({ expert }, { status: 201 });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const experts = await db.expert.findMany({
    where: { clerkUserId: userId },
    include: {
      aliases: true,
      sourceEndpoints: { orderBy: { priorityScore: "desc" } },
      discoveryRuns: { orderBy: { startedAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ experts });
}
