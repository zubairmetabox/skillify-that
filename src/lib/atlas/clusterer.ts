import { groq, GROQ_MODELS } from "@/lib/groq";
import { trackGroqUsage } from "@/lib/groq-usage";
import type { SkillAtom } from "@prisma/client";

export type ClusterAssignment = {
  clusterName: string;
  clusterDescription: string;
  atomIds: string[];
};

const SYSTEM_PROMPT = `You are a skill taxonomy expert. Given a list of SkillAtoms extracted from an expert's content, group them into 5-10 named skill clusters representing distinct, teachable skills.

Rules:
- Each cluster should be a coherent, self-contained skill (e.g., "Cold Calling Scripts", "Objection Handling", "Pipeline Management")
- Cluster names should be action-oriented and specific (not generic like "Mindset" or "General Tips")
- Every atom must be assigned to exactly one cluster
- Clusters should have at least 2 atoms; merge thin clusters
- Return a JSON object with the top-level key EXACTLY named "clusters" containing an array

Each cluster:
- clusterName: concise skill name (3-6 words)
- clusterDescription: one sentence describing the skill
- atomIds: array of atom IDs belonging to this cluster`;

export async function clusterAtoms(
  atoms: SkillAtom[],
  domain: string,
  expertName: string,
  model: string = GROQ_MODELS.fast
): Promise<ClusterAssignment[]> {
  if (atoms.length === 0) return [];

  // Use compact numeric indices instead of full cuid strings to stay under groq/compound context limit
  const atomSummaries = atoms.map((a, i) => ({
    id: String(i),
    title: a.title.slice(0, 80),
    type: a.atomType,
    domain: a.domain,
  }));

  const userPrompt = `Expert: ${expertName}
Domain: ${domain || "general"}
Total atoms: ${atoms.length}

Atoms to cluster:
${JSON.stringify(atomSummaries, null, 2)}

Group these into skill clusters. Return JSON with key "clusters".`;

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 3000,
    });

    trackGroqUsage(completion.usage?.total_tokens ?? 0);
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    // Find the clusters array regardless of the key name the LLM used
    let clusters: unknown[] = [];
    if (Array.isArray(parsed)) {
      clusters = parsed;
    } else if (Array.isArray(parsed.clusters)) {
      clusters = parsed.clusters;
    } else {
      for (const val of Object.values(parsed)) {
        if (Array.isArray(val) && val.length > 0) { clusters = val; break; }
      }
    }

    if (clusters.length === 0) {
      throw new Error("LLM returned no valid clusters. Raw response: " + raw.slice(0, 300));
    }

    return clusters
      .filter(isValidCluster)
      .map((c) => ({
        ...c,
        atomIds: (c.atomIds as string[])
          .map((idx) => atoms[parseInt(idx, 10)]?.id)
          .filter(Boolean) as string[],
      }))
      .filter((c) => c.atomIds.length >= 1);
  } catch (err) {
    // Re-throw with a clean, readable message
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes("rate_limit_exceeded") || raw.includes("429")) {
      const wait = raw.match(/Please try again in ([^.]+)/)?.[1];
      throw new Error(`Groq rate limit reached${wait ? ` — try again in ${wait}` : ""}. Upgrade at console.groq.com or wait for daily reset.`);
    }
    throw err;
  }
}

function isValidCluster(c: unknown): c is ClusterAssignment {
  if (!c || typeof c !== "object") return false;
  const cluster = c as Record<string, unknown>;
  // Normalize alternate field names the LLM sometimes uses
  if (!cluster.clusterName && cluster.name) cluster.clusterName = cluster.name;
  if (!cluster.clusterDescription && cluster.description) cluster.clusterDescription = cluster.description;
  if (!cluster.atomIds && cluster.atoms) cluster.atomIds = cluster.atoms;
  if (!cluster.atomIds && cluster.atom_ids) cluster.atomIds = cluster.atom_ids;
  return (
    typeof cluster.clusterName === "string" && cluster.clusterName.length > 0 &&
    Array.isArray(cluster.atomIds)
  );
}
