import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ atlasId: string; pkgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { atlasId, pkgId } = await params;

  const pkg = await db.skillPackage.findFirst({
    where: {
      id: pkgId,
      atlasId,
      atlas: { expert: { clerkUserId: userId } },
    },
    include: { cluster: true },
  });

  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const steps = pkg.steps as { order: number; action: string; detail: string }[];
  const examples = pkg.examples as { scenario: string; application: string }[];
  const antiPatterns = pkg.antiPatterns as { pattern: string; why: string }[];

  const lines: string[] = [
    `# ${pkg.name}`,
    ``,
    `**Cluster:** ${pkg.cluster?.name ?? "—"}  `,
    `**Coverage:** ${(pkg.coverageScore * 100).toFixed(0)}%`,
    ``,
    `**Trigger:** ${pkg.trigger}`,
    ``,
  ];

  if (steps.length > 0) {
    lines.push(`## Steps`);
    for (const step of steps) {
      lines.push(`${step.order}. **${step.action}** — ${step.detail}`);
    }
    lines.push(``);
  }

  if (examples.length > 0) {
    lines.push(`## Examples`);
    for (const ex of examples) {
      lines.push(`- **${ex.scenario}:** ${ex.application}`);
    }
    lines.push(``);
  }

  if (antiPatterns.length > 0) {
    lines.push(`## Anti-patterns`);
    for (const ap of antiPatterns) {
      lines.push(`- ❌ **${ap.pattern}** — ${ap.why}`);
    }
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`*${pkg.evidenceSummary}*`);

  const slug = pkg.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.md"`,
    },
  });
}
