import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SELECTABLE_MODELS, DEFAULT_MODEL } from "@/lib/groq-models";

const ALLOWED_MODEL_IDS = SELECTABLE_MODELS.map((m) => m.id);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await db.userSettings.findUnique({ where: { clerkUserId: userId } });

  return NextResponse.json({
    preferredModel: settings?.preferredModel ?? DEFAULT_MODEL,
  });
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { preferredModel } = body;

  if (!preferredModel || !ALLOWED_MODEL_IDS.includes(preferredModel)) {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });
  }

  const settings = await db.userSettings.upsert({
    where: { clerkUserId: userId },
    create: { clerkUserId: userId, preferredModel },
    update: { preferredModel },
  });

  return NextResponse.json({ preferredModel: settings.preferredModel });
}
