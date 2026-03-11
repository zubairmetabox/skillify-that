import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { GROQ_DAILY_LIMIT } from "@/lib/groq-usage";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const daysParam = new URL(req.url).searchParams.get("days");
    const days = Math.min(Math.max(Number(daysParam) || 1, 1), 30);
    const today = new Date().toISOString().slice(0, 10);

    // Build date range: today and N-1 days before
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const rows = await db.groqUsage.findMany({
      where: { date: { in: dates } },
      orderBy: { date: "desc" },
    });

    const todayRow = rows.find((r) => r.date === today);

    return NextResponse.json({
      today: {
        tokensUsed: todayRow?.tokensUsed ?? 0,
        requestCount: todayRow?.requestCount ?? 0,
        dailyLimit: GROQ_DAILY_LIMIT,
      },
      history: rows,
      dailyLimit: GROQ_DAILY_LIMIT,
    });
  } catch (err) {
    console.error("[groq-usage GET]", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
