import { groq, GROQ_MODELS } from "@/lib/groq";
import { trackGroqUsage } from "@/lib/groq-usage";
import type { AtomType, AttributionLevel } from "@prisma/client";

export type ExtractedAtom = {
  atomType: AtomType;
  title: string;
  body: string;
  domain: string;
  tags: string[];
  attributionLevel: AttributionLevel;
  evidenceStrength: number;
  domainRelevance: number;
  sourceQuote: string;
};

const SYSTEM_PROMPT = `You are a skill extraction engine. Given a chunk of content from an expert, extract reusable "SkillAtoms" — discrete, actionable knowledge primitives.

Each SkillAtom must be:
- Concrete and actionable (not vague platitudes)
- Directly attributable to the expert's own words or methods
- Self-contained (understandable without surrounding context)

Return a JSON array of SkillAtoms. Each atom has:
- atomType: one of PRINCIPLE | TACTIC | SCRIPT | FRAMEWORK | DIAGNOSTIC | OBJECTION_RESPONSE | WORKFLOW | INSIGHT
- title: short label (5-10 words)
- body: full explanation of the skill/knowledge (2-5 sentences, specific and actionable)
- domain: the skill domain (e.g. "sales", "mindset", "leadership")
- tags: array of 2-5 keyword tags
- attributionLevel: L1_DIRECT (expert's own words) | L2_FIRST_PARTY (expert's org) | L3_SECONDARY (third-party about expert)
- evidenceStrength: 0.0-1.0 (how strongly supported by the content)
- domainRelevance: 0.0-1.0 (how relevant to the expert's core domain)
- sourceQuote: a direct quote or near-quote from the content supporting this atom (max 200 chars)

Extract 3-8 atoms per chunk. Only extract atoms with evidenceStrength >= 0.5. Return [] if no strong atoms found.`;

export async function extractAtomsFromChunk(
  chunk: string,
  expertName: string,
  domain: string,
  sourceUrl: string,
  model: string = GROQ_MODELS.fast
): Promise<ExtractedAtom[]> {
  const userPrompt = `Expert: ${expertName}
Domain focus: ${domain || "general"}
Source URL: ${sourceUrl}

Content chunk:
"""
${chunk.slice(0, 4000)}
"""

Extract SkillAtoms from this content. Return a JSON array only, no other text.`;

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000,
    });

    trackGroqUsage(completion.usage?.total_tokens ?? 0);
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    // Handle both {atoms: [...]} and [...] and any top-level array key
    let rawAtoms: unknown[] = [];
    if (Array.isArray(parsed)) {
      rawAtoms = parsed;
    } else {
      // Find first array value in the response object
      for (const val of Object.values(parsed)) {
        if (Array.isArray(val)) { rawAtoms = val; break; }
      }
    }

    return rawAtoms
      .map(coerceAtom)
      .filter((a): a is ExtractedAtom => isValidAtom(a))
      .filter((a) => a.evidenceStrength >= 0.5);
  } catch {
    return [];
  }
}

/** Coerce numeric fields so LLM strings like "0.9" don't fail validation */
function coerceAtom(a: unknown): unknown {
  if (!a || typeof a !== "object") return a;
  const atom = a as Record<string, unknown>;
  return {
    ...atom,
    evidenceStrength: typeof atom.evidenceStrength === "number"
      ? atom.evidenceStrength
      : parseFloat(String(atom.evidenceStrength ?? "0")),
    domainRelevance: typeof atom.domainRelevance === "number"
      ? atom.domainRelevance
      : parseFloat(String(atom.domainRelevance ?? "0")),
    tags: Array.isArray(atom.tags) ? atom.tags : [],
    sourceQuote: atom.sourceQuote ?? "",
    domain: atom.domain ?? "",
  };
}

function isValidAtom(a: unknown): a is ExtractedAtom {
  if (!a || typeof a !== "object") return false;
  const atom = a as Record<string, unknown>;
  return (
    typeof atom.title === "string" && atom.title.length > 0 &&
    typeof atom.body === "string" && atom.body.length > 0 &&
    typeof atom.atomType === "string" &&
    typeof atom.attributionLevel === "string" &&
    typeof atom.evidenceStrength === "number" && !isNaN(atom.evidenceStrength) &&
    typeof atom.domainRelevance === "number" && !isNaN(atom.domainRelevance)
  );
}

/**
 * Splits long text into overlapping chunks for extraction.
 */
export function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.length > 100) chunks.push(chunk);
    if (i + chunkSize >= words.length) break;
  }

  return chunks;
}
