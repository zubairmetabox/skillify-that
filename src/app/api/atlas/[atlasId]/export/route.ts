import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { exportAtlas } from "../route";

type Params = { params: Promise<{ atlasId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { atlasId } = await params;

  try {
    const markdown = await exportAtlas(atlasId, userId);
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="skill-atlas-${atlasId.slice(0, 8)}.md"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Atlas not found" }, { status: 404 });
  }
}
