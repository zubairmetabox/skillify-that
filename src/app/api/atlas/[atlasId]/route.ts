import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { SkillPackage } from "@prisma/client";

type Params = { params: Promise<{ atlasId: string }> };

// GET /api/atlas/:atlasId — full atlas with packages
export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { atlasId } = await params;

  const atlas = await db.skillAtlas.findFirst({
    where: { id: atlasId, expert: { clerkUserId: userId } },
    include: {
      clusters: {
        include: { packages: true, atoms: { select: { id: true, title: true, atomType: true } } },
        orderBy: { atomCount: "desc" },
      },
    },
  });

  if (!atlas) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ atlas });
}

// GET /api/atlas/:atlasId?export=true — markdown export
export async function exportAtlas(atlasId: string, userId: string): Promise<string> {
  const atlas = await db.skillAtlas.findFirst({
    where: { id: atlasId, expert: { clerkUserId: userId } },
    include: {
      expert: true,
      clusters: { include: { packages: true }, orderBy: { atomCount: "desc" } },
    },
  });

  if (!atlas) throw new Error("Atlas not found");

  const lines: string[] = [
    `# ${atlas.title}`,
    ``,
    `**Domain:** ${atlas.domain}  `,
    `**Expert:** ${atlas.expert.canonicalName}  `,
    `**Skill packages:** ${atlas.packageCount}  `,
    `**Coverage score:** ${(atlas.coverageScore * 100).toFixed(0)}%  `,
    `**Generated:** ${new Date(atlas.createdAt).toLocaleDateString()}`,
    ``,
    `---`,
    ``,
  ];

  for (const cluster of atlas.clusters) {
    for (const pkg of cluster.packages as SkillPackage[]) {
      lines.push(`## ${pkg.name}`);
      lines.push(``);
      lines.push(`**Trigger:** ${pkg.trigger}`);
      lines.push(``);

      const steps = pkg.steps as { order: number; action: string; detail: string }[];
      if (steps.length > 0) {
        lines.push(`### Steps`);
        for (const step of steps) {
          lines.push(`${step.order}. **${step.action}** — ${step.detail}`);
        }
        lines.push(``);
      }

      const examples = pkg.examples as { scenario: string; application: string }[];
      if (examples.length > 0) {
        lines.push(`### Examples`);
        for (const ex of examples) {
          lines.push(`- **${ex.scenario}:** ${ex.application}`);
        }
        lines.push(``);
      }

      const antiPatterns = pkg.antiPatterns as { pattern: string; why: string }[];
      if (antiPatterns.length > 0) {
        lines.push(`### Anti-patterns`);
        for (const ap of antiPatterns) {
          lines.push(`- ❌ **${ap.pattern}** — ${ap.why}`);
        }
        lines.push(``);
      }

      lines.push(`*Evidence: ${pkg.evidenceSummary}*`);
      lines.push(`*Coverage: ${(pkg.coverageScore * 100).toFixed(0)}%*`);
      lines.push(``);
      lines.push(`---`);
      lines.push(``);
    }
  }

  if (atlas.gaps.length > 0) {
    lines.push(`## Gaps & Notes`);
    for (const gap of atlas.gaps) {
      lines.push(`- ${gap}`);
    }
  }

  return lines.join("\n");
}
