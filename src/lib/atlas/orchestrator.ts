import { db } from "@/lib/db";
import { clusterAtoms } from "./clusterer";
import { synthesizePackage } from "./synthesizer";
import { DEFAULT_MODEL } from "@/lib/groq";

export async function buildAtlas(
  expertId: string,
  opts?: { resume?: boolean; model?: string }
): Promise<string> {
  const expert = await db.expert.findUnique({
    where: { id: expertId },
    include: { skillAtoms: true },
  });
  if (!expert) throw new Error("Expert not found");

  const atoms = expert.skillAtoms;
  if (atoms.length === 0) throw new Error("No skill atoms found. Run ingestion first.");

  const domain = expert.domain ?? "general";
  const model = opts?.model ?? DEFAULT_MODEL;

  // ─── Resume path ──────────────────────────────────────────────────────────
  if (opts?.resume) {
    const existing = await db.skillAtlas.findFirst({
      where: { expertId },
      include: { clusters: { include: { packages: true } } },
    });
    if (!existing) throw new Error("No atlas found to resume. Start a fresh build instead.");

    const clustersNeedingPackages = existing.clusters.filter((c) => c.packages.length === 0);
    if (clustersNeedingPackages.length === 0) {
      await db.skillAtlas.update({
        where: { id: existing.id },
        data: { buildStatus: "COMPLETED" },
      });
      return existing.id;
    }

    const log = [...existing.buildLog, `Resuming — ${clustersNeedingPackages.length} cluster(s) still need packages...`];
    await db.skillAtlas.update({
      where: { id: existing.id },
      data: { buildStatus: "RUNNING", buildLog: log },
    });

    const synthResults = await Promise.allSettled(
      clustersNeedingPackages.map(async (cluster) => {
        const clusterAtomsList = await db.skillAtom.findMany({ where: { clusterId: cluster.id } });
        const pkg = await synthesizePackage(
          cluster.name,
          cluster.description ?? "",
          clusterAtomsList,
          expert.canonicalName,
          model
        );
        return { clusterId: cluster.id, pkg };
      })
    );

    for (const result of synthResults) {
      if (result.status === "rejected" || !result.value.pkg) continue;
      const { clusterId, pkg } = result.value;
      await db.skillPackage.create({
        data: {
          expertId,
          clusterId,
          atlasId: existing.id,
          name: pkg.name,
          trigger: pkg.trigger,
          steps: pkg.steps,
          examples: pkg.examples,
          antiPatterns: pkg.antiPatterns,
          evidenceSummary: pkg.evidenceSummary,
          coverageScore: pkg.coverageScore,
        },
      });
    }

    const allPackages = await db.skillPackage.findMany({ where: { atlasId: existing.id } });
    const avgCoverage =
      allPackages.length > 0
        ? allPackages.reduce((s, p) => s + p.coverageScore, 0) / allPackages.length
        : 0;

    const newCount = synthResults.filter((r) => r.status === "fulfilled" && r.value.pkg).length;
    await db.skillAtlas.update({
      where: { id: existing.id },
      data: {
        packageCount: allPackages.length,
        coverageScore: avgCoverage,
        buildStatus: "COMPLETED",
        buildLog: [
          ...log,
          `✓ Resume complete — ${newCount} new packages · ${allPackages.length} total · ${(avgCoverage * 100).toFixed(0)}% coverage`,
        ],
      },
    });

    return existing.id;
  }

  // ─── Fresh build path ─────────────────────────────────────────────────────
  await db.skillAtlas.deleteMany({ where: { expertId } });

  const atlas = await db.skillAtlas.create({
    data: {
      expertId,
      domain,
      title: `${expert.canonicalName} — ${domain} Skill Atlas`,
      atomCount: atoms.length,
      buildStatus: "RUNNING",
      buildLog: [`Starting atlas build — ${atoms.length} atoms`],
    },
  });

  const log: string[] = [`Starting atlas build — ${atoms.length} atoms`];

  const addLog = async (msg: string) => {
    log.push(msg);
    await db.skillAtlas.update({ where: { id: atlas.id }, data: { buildLog: log } });
  };

  try {
    await addLog(`Clustering atoms into skill groups...`);
    const clusterAssignments = await clusterAtoms(atoms, domain, expert.canonicalName, model);
    if (clusterAssignments.length === 0) throw new Error("Clustering produced no results");

    await addLog(`Found ${clusterAssignments.length} clusters — synthesizing packages in parallel...`);

    const atomMap = new Map(atoms.map((a) => [a.id, a]));
    const clusterData: {
      clusterId: string;
      assignment: (typeof clusterAssignments)[0];
      clusterAtomsList: typeof atoms;
    }[] = [];

    for (const assignment of clusterAssignments) {
      const clusterAtomsList = assignment.atomIds
        .map((id) => atomMap.get(id))
        .filter(Boolean) as typeof atoms;
      if (clusterAtomsList.length === 0) continue;

      const cluster = await db.skillCluster.create({
        data: {
          expertId,
          atlasId: atlas.id,
          name: assignment.clusterName,
          description: assignment.clusterDescription,
          domain,
          atomCount: clusterAtomsList.length,
        },
      });

      await db.skillAtom.updateMany({
        where: { id: { in: clusterAtomsList.map((a) => a.id) } },
        data: { clusterId: cluster.id },
      });

      clusterData.push({ clusterId: cluster.id, assignment, clusterAtomsList });
    }

    // Parallel synthesis
    const synthResults = await Promise.allSettled(
      clusterData.map(({ clusterId, assignment, clusterAtomsList }) =>
        synthesizePackage(
          assignment.clusterName,
          assignment.clusterDescription,
          clusterAtomsList,
          expert.canonicalName,
          model
        ).then((pkg) => ({ clusterId, pkg }))
      )
    );

    const packages: { name: string; coverageScore: number }[] = [];

    for (const result of synthResults) {
      if (result.status === "rejected" || !result.value.pkg) continue;
      const { clusterId, pkg } = result.value;

      await db.skillPackage.create({
        data: {
          expertId,
          clusterId,
          atlasId: atlas.id,
          name: pkg.name,
          trigger: pkg.trigger,
          steps: pkg.steps,
          examples: pkg.examples,
          antiPatterns: pkg.antiPatterns,
          evidenceSummary: pkg.evidenceSummary,
          coverageScore: pkg.coverageScore,
        },
      });

      packages.push({ name: pkg.name, coverageScore: pkg.coverageScore });
    }

    const failedSynth = synthResults.filter((r) => r.status === "rejected" || !r.value.pkg).length;

    const unclusteredCount = atoms.filter((a) => !a.clusterId).length;
    const gaps: string[] = [];
    if (unclusteredCount > 0) gaps.push(`${unclusteredCount} atoms unassigned to any cluster`);
    if (packages.length < 3) gaps.push("Low skill package count — consider ingesting more sources");

    const avgCoverage =
      packages.length > 0
        ? packages.reduce((s, p) => s + p.coverageScore, 0) / packages.length
        : 0;

    const summaryLine = failedSynth > 0
      ? `✓ Done — ${packages.length} packages · ${(avgCoverage * 100).toFixed(0)}% coverage (${failedSynth} cluster(s) failed synthesis — use Resume to retry)`
      : `✓ Done — ${packages.length} packages · ${(avgCoverage * 100).toFixed(0)}% coverage`;

    log.push(summaryLine);

    await db.skillAtlas.update({
      where: { id: atlas.id },
      data: {
        clusterCount: clusterAssignments.length,
        packageCount: packages.length,
        coverageScore: avgCoverage,
        gaps,
        buildStatus: failedSynth > 0 && packages.length === 0 ? "FAILED" : "COMPLETED",
        buildLog: log,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    log.push(`✗ Error: ${msg}`);
    await db.skillAtlas.update({
      where: { id: atlas.id },
      data: { buildStatus: "FAILED", buildLog: log },
    });
  }

  return atlas.id;
}
