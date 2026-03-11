import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ atlasId: string; pkgId: string }> };

const VALID_STATES = ["DRAFT", "REVIEWED", "APPROVED", "DEPRECATED"];

export async function PATCH(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { atlasId, pkgId } = await params;

  const pkg = await db.skillPackage.findFirst({
    where: { id: pkgId, atlasId, atlas: { expert: { clerkUserId: userId } } },
  });
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { releaseState, reviewNotes } = body as {
    releaseState?: string;
    reviewNotes?: string;
  };

  if (releaseState !== undefined && !VALID_STATES.includes(releaseState)) {
    return NextResponse.json(
      { error: `Invalid releaseState. Must be one of: ${VALID_STATES.join(", ")}` },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    reviewedAt: new Date(),
    reviewedBy: userId,
  };
  if (releaseState !== undefined) updateData.releaseState = releaseState;
  if (reviewNotes !== undefined) updateData.reviewNotes = reviewNotes;

  const updated = await db.skillPackage.update({
    where: { id: pkgId },
    data: updateData,
  });

  return NextResponse.json({ pkg: updated });
}
