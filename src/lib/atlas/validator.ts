import { groq, GROQ_MODELS } from "@/lib/groq";
import { trackGroqUsage } from "@/lib/groq-usage";
import { db } from "@/lib/db";
import type { SkillPackage } from "@prisma/client";

export type PackageValidationResult = {
  pkgId: string;
  errors: string[];
  warnings: string[];
};

export type ValidationReport = {
  packages: PackageValidationResult[];
  atlasErrors: string[];
  atlasWarnings: string[];
  status: "PASSED" | "FAILED" | "PARTIAL";
};

function runStaticChecks(packages: SkillPackage[]): PackageValidationResult[] {
  return packages.map((pkg) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const steps = Array.isArray(pkg.steps) ? pkg.steps : [];

    if (!pkg.trigger || pkg.trigger.trim().length === 0) {
      errors.push("Trigger is empty");
    } else if (pkg.trigger.trim().length < 10) {
      warnings.push("Trigger is very short — may be too vague");
    }

    if (steps.length < 3) {
      errors.push(`Steps has ${steps.length} item(s) — minimum 3 required`);
    }

    if (!pkg.evidenceSummary || pkg.evidenceSummary.trim().length === 0) {
      errors.push("Evidence summary is empty");
    }

    const nameLen = pkg.name.trim().length;
    if (nameLen < 3 || nameLen > 80) {
      errors.push(`Package name must be 3–80 characters (got ${nameLen})`);
    }

    return { pkgId: pkg.id, errors, warnings };
  });
}

async function runSemanticLint(
  packages: SkillPackage[],
  model: string
): Promise<PackageValidationResult[]> {
  if (packages.length === 0) return [];

  const compact = packages.map((pkg) => {
    const steps = Array.isArray(pkg.steps) ? pkg.steps as { action?: string }[] : [];
    return {
      id: pkg.id,
      trigger: pkg.trigger,
      steps: steps.slice(0, 3).map((s) => s.action ?? String(s)),
      evidenceSummary: pkg.evidenceSummary.slice(0, 200),
    };
  });

  const systemPrompt = `You are a skill package quality reviewer. Given an array of skill packages, evaluate each one for quality issues.

For each package, check:
1. TRIGGER: Does it precisely describe WHEN to apply this skill? Flag if it uses vague language like "when needed", "use this skill", "to improve", or fails to name a concrete triggering situation.
2. STEPS: Are they action-oriented (start with a verb)? Flag steps that are nouns, passive voice, or ambiguous.
3. EVIDENCE: Does the summary reference actual sources or content types (videos, transcripts, interviews)? Flag generic summaries like "based on the expert's experience".

Return a JSON object with key "results" containing an array. Each element:
{ "id": "<packageId>", "errors": ["..."], "warnings": ["..."] }

Be concise. Max 3 errors and 3 warnings per package. If a package is clean, return empty arrays.`;

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Packages to review:\n${JSON.stringify(compact, null, 2)}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: Math.min(150 * packages.length, 4000),
    });

    trackGroqUsage(completion.usage?.total_tokens ?? 0);

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const results: { id: string; errors: string[]; warnings: string[] }[] =
      Array.isArray(parsed.results) ? parsed.results : [];

    return packages.map((pkg) => {
      const found = results.find((r) => r.id === pkg.id);
      return {
        pkgId: pkg.id,
        errors: found?.errors ?? [],
        warnings: found?.warnings ?? [],
      };
    });
  } catch {
    // Semantic lint failure is non-fatal — static checks still persist
    return packages.map((pkg) => ({ pkgId: pkg.id, errors: [], warnings: [] }));
  }
}

function runAtlasChecks(
  packages: SkillPackage[]
): { atlasErrors: string[]; atlasWarnings: string[] } {
  const atlasErrors: string[] = [];
  const atlasWarnings: string[] = [];

  const triggerWords = packages.map((pkg) =>
    pkg.trigger
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
  );

  // Trigger collision: same first 3 words
  for (let i = 0; i < packages.length; i++) {
    for (let j = i + 1; j < packages.length; j++) {
      const prefix1 = triggerWords[i].slice(0, 3).join(" ");
      const prefix2 = triggerWords[j].slice(0, 3).join(" ");
      if (prefix1.length > 0 && prefix1 === prefix2) {
        atlasErrors.push(
          `Trigger collision: "${packages[i].name}" and "${packages[j].name}" share the same opening phrase`
        );
      }
    }
  }

  // Near-duplicate triggers: Jaccard similarity ≥ 0.6
  for (let i = 0; i < packages.length; i++) {
    for (let j = i + 1; j < packages.length; j++) {
      const setA = new Set(triggerWords[i]);
      const setB = new Set(triggerWords[j]);
      const intersection = new Set([...setA].filter((w) => setB.has(w)));
      const union = new Set([...setA, ...setB]);
      if (union.size > 0 && intersection.size / union.size >= 0.6) {
        atlasWarnings.push(
          `Possible duplicate triggers: "${packages[i].name}" vs "${packages[j].name}"`
        );
      }
    }
  }

  return { atlasErrors, atlasWarnings };
}

export async function validateAtlas(
  atlasId: string,
  model: string = GROQ_MODELS.fast
): Promise<ValidationReport> {
  const packages = await db.skillPackage.findMany({ where: { atlasId } });

  // Run static checks
  const staticResults = runStaticChecks(packages);

  // Run semantic lint (one batched Groq call)
  const semanticResults = await runSemanticLint(packages, model);

  // Merge static + semantic per package
  const merged: PackageValidationResult[] = staticResults.map((s, i) => ({
    pkgId: s.pkgId,
    errors: [...s.errors, ...(semanticResults[i]?.errors ?? [])],
    warnings: [...s.warnings, ...(semanticResults[i]?.warnings ?? [])],
  }));

  // Atlas-level checks
  const { atlasErrors, atlasWarnings } = runAtlasChecks(packages);

  // Compute status
  const anyErrors = merged.some((r) => r.errors.length > 0) || atlasErrors.length > 0;
  const allHaveErrors = merged.length > 0 && merged.every((r) => r.errors.length > 0);
  let status: "PASSED" | "FAILED" | "PARTIAL";
  if (!anyErrors) {
    status = "PASSED";
  } else if (allHaveErrors) {
    status = "FAILED";
  } else {
    status = "PARTIAL";
  }

  // Persist results to DB
  await Promise.all([
    ...merged.map((r) =>
      db.skillPackage.update({
        where: { id: r.pkgId },
        data: { validationErrors: r.errors, validationWarnings: r.warnings },
      })
    ),
    db.skillAtlas.update({
      where: { id: atlasId },
      data: {
        validationStatus: status,
        atlasValidationNotes:
          [...atlasErrors, ...atlasWarnings].join("\n") || null,
      },
    }),
  ]);

  return { packages: merged, atlasErrors, atlasWarnings, status };
}
