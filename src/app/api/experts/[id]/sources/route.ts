import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { ComplianceStatus } from "@prisma/client";

const updateSourceSchema = z.object({
  complianceStatus: z.enum(["PENDING", "ALLOWED", "DISALLOWED", "REQUIRES_REVIEW"]).optional(),
  complianceNote: z.string().optional(),
  label: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const expert = await db.expert.findUnique({ where: { id } });
  if (!expert || expert.clerkUserId !== userId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sources = await db.sourceEndpoint.findMany({
    where: { expertId: id },
    include: { policyProfile: true },
    orderBy: { priorityScore: "desc" },
  });

  return NextResponse.json({ sources });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const expert = await db.expert.findUnique({ where: { id } });
  if (!expert || expert.clerkUserId !== userId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const sourceId = url.searchParams.get("sourceId");
  if (!sourceId) return NextResponse.json({ error: "sourceId required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = updateSourceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updated = await db.sourceEndpoint.update({
    where: { id: sourceId, expertId: id },
    data: {
      ...(parsed.data.complianceStatus && {
        complianceStatus: parsed.data.complianceStatus as ComplianceStatus,
      }),
      ...(parsed.data.complianceNote && { complianceNote: parsed.data.complianceNote }),
      ...(parsed.data.label && { label: parsed.data.label }),
    },
  });

  return NextResponse.json({ source: updated });
}
