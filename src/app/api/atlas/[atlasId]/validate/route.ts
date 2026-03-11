import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateAtlas } from "@/lib/atlas/validator";
import { DEFAULT_MODEL } from "@/lib/groq";

type Params = { params: Promise<{ atlasId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { atlasId } = await params;

  const atlas = await db.skillAtlas.findFirst({
    where: { id: atlasId, expert: { clerkUserId: userId } },
  });
  if (!atlas) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (atlas.buildStatus !== "COMPLETED") {
    return NextResponse.json(
      { error: "Atlas must be fully built before validating" },
      { status: 400 }
    );
  }

  const pkgCount = await db.skillPackage.count({ where: { atlasId } });
  if (pkgCount === 0) {
    return NextResponse.json({ error: "Atlas has no skill packages" }, { status: 400 });
  }

  const userSettings = await db.userSettings.findUnique({ where: { clerkUserId: userId } });
  const model = userSettings?.preferredModel ?? DEFAULT_MODEL;

  try {
    const report = await validateAtlas(atlasId, model);
    return NextResponse.json({ report });
  } catch (err) {
    console.error("[validate POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Validation failed" },
      { status: 500 }
    );
  }
}
