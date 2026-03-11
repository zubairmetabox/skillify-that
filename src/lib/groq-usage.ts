import { db } from "@/lib/db";

export const GROQ_DAILY_LIMIT = 500_000; // llama-3.1-8b-instant TPD

export async function trackGroqUsage(tokens: number): Promise<void> {
  if (!tokens || tokens <= 0) return;
  const date = new Date().toISOString().slice(0, 10);
  await db.groqUsage
    .upsert({
      where: { date },
      create: { date, tokensUsed: tokens, requestCount: 1 },
      update: { tokensUsed: { increment: tokens }, requestCount: { increment: 1 } },
    })
    .catch(() => {}); // non-critical — never fail the main operation
}
