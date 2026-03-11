import { groq, GROQ_MODELS } from "@/lib/groq";
import { trackGroqUsage } from "@/lib/groq-usage";
import type { SkillAtom } from "@prisma/client";

export type SynthesizedPackage = {
  name: string;
  trigger: string;
  steps: { order: number; action: string; detail: string }[];
  examples: { scenario: string; application: string }[];
  antiPatterns: { pattern: string; why: string }[];
  evidenceSummary: string;
  coverageScore: number;
};

const SYSTEM_PROMPT = `You are a skill package engineer. Given a cluster of SkillAtoms from an expert, synthesize a structured, actionable skill package.

The package must be:
- Concrete and immediately usable (a practitioner should be able to apply it)
- Evidence-backed (grounded in the provided atoms)
- Honest about gaps (don't invent steps not supported by the atoms)

Return a JSON object with these fields:
- name: skill package name (same as cluster name)
- trigger: precise description of WHEN to apply this skill (1-2 sentences)
- steps: array of {order, action, detail} — ordered procedure, 3-7 steps
- examples: array of {scenario, application} — 2-3 concrete examples
- antiPatterns: array of {pattern, why} — 2-3 common mistakes to avoid
- evidenceSummary: 1-2 sentences summarizing the evidence base for this package
- coverageScore: 0.0-1.0 reflecting how well the atoms cover this skill (be honest)`;

export async function synthesizePackage(
  clusterName: string,
  clusterDescription: string,
  atoms: SkillAtom[],
  expertName: string,
  model: string = GROQ_MODELS.fast
): Promise<SynthesizedPackage | null> {
  if (atoms.length === 0) return null;

  const atomContent = atoms.map((a) => ({
    type: a.atomType,
    title: a.title,
    body: a.body?.slice(0, 400),
    evidence: a.evidenceStrength,
    quote: a.sourceQuote?.slice(0, 200),
  }));

  const userPrompt = `Expert: ${expertName}
Skill cluster: ${clusterName}
Cluster description: ${clusterDescription}
Atoms (${atoms.length}):
${JSON.stringify(atomContent, null, 2)}

Synthesize a complete skill package from these atoms. Return JSON only.`;

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2500,
    });

    trackGroqUsage(completion.usage?.total_tokens ?? 0);
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    if (!parsed.name || !parsed.trigger || !Array.isArray(parsed.steps)) return null;

    return {
      name: parsed.name,
      trigger: parsed.trigger,
      steps: parsed.steps ?? [],
      examples: parsed.examples ?? [],
      antiPatterns: parsed.antiPatterns ?? [],
      evidenceSummary: parsed.evidenceSummary ?? "",
      coverageScore: typeof parsed.coverageScore === "number" ? parsed.coverageScore : 0.5,
    };
  } catch (err) {
    throw err;
  }
}
