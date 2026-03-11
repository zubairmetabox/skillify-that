import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { groq, GROQ_MODELS } from "@/lib/groq";
import { trackGroqUsage } from "@/lib/groq-usage";

export type Candidate = {
  canonicalName: string;
  domain: string;
  bio: string;
  knownUrls: string[];
  aliases: string[];
  confidence: "high" | "medium" | "low";
  isObvious: boolean;
  wikipediaThumb?: string;
};

type WikiSearchResult = {
  title: string;
  snippet: string;
  pageid: number;
};

type WikiSummary = {
  title: string;
  extract: string;
  thumbnail?: { source: string };
  description?: string;
};

async function fetchWikipediaCandidates(name: string): Promise<{ summaries: WikiSummary[]; thumbs: Record<string, string> }> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&srlimit=5&origin=*`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
    if (!searchRes.ok) return { summaries: [], thumbs: {} };

    const searchData = await searchRes.json() as { query: { search: WikiSearchResult[] } };
    const results = searchData.query?.search ?? [];

    // Fetch summaries for top 3 results in parallel
    const top3 = results.slice(0, 3);
    const summaryFetches = top3.map(async (r) => {
      try {
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(r.title)}`;
        const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(5000) });
        if (!summaryRes.ok) return null;
        return summaryRes.json() as Promise<WikiSummary>;
      } catch {
        return null;
      }
    });

    const summaryResults = await Promise.all(summaryFetches);
    const summaries = summaryResults.filter((s): s is WikiSummary => s !== null);

    const thumbs: Record<string, string> = {};
    for (const s of summaries) {
      if (s.thumbnail?.source) thumbs[s.title] = s.thumbnail.source;
    }

    return { summaries, thumbs };
  } catch {
    return { summaries: [], thumbs: {} };
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let name: string;
  try {
    const body = await req.json();
    name = typeof body.name === "string" ? body.name.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  // Fetch Wikipedia context
  const { summaries, thumbs } = await fetchWikipediaCandidates(name);

  const wikipediaContext = summaries.length > 0
    ? summaries.map((s) => `• ${s.title}${s.description ? ` (${s.description})` : ""}: ${s.extract?.slice(0, 300)}`).join("\n")
    : "No Wikipedia results found.";

  const prompt = `You are identifying public figures by name for a knowledge-extraction tool called Skillify.

Wikipedia search context for "${name}":
${wikipediaContext}

Task: Identify the top public figures, experts, creators, entrepreneurs, coaches, or authors known as "${name}".

Rules:
- Each candidate must be a DIFFERENT real-world person. Never list the same person twice under different domains.
- Include anyone who produces or has produced notable public content: books, courses, YouTube, podcasts, speeches, business advice, self-help, politics, sports, arts, science, or any domain
- Exclude only fictional characters and purely private individuals with no public presence
- If one person clearly dominates by this name (e.g. a globally famous figure), set isObvious: true and return only that one candidate
- For genuinely ambiguous names (truly different people share the name), include up to 4 distinct candidates
- For knownUrls: only include URLs you are HIGHLY confident about. Format YouTube as https://www.youtube.com/@handle if known
- Keep bio to 2 concise sentences focused on what they are known for

Return JSON exactly as: { "candidates": Array<{ canonicalName: string, domain: string, bio: string, knownUrls: string[], aliases: string[], confidence: "high"|"medium"|"low", isObvious: boolean }> }

Return an empty candidates array if no notable public-knowledge figures exist by this name.`;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODELS.fast,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    trackGroqUsage(completion.usage?.total_tokens ?? 0);
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { candidates?: unknown[] };

    let candidates: Candidate[] = [];
    if (Array.isArray(parsed.candidates)) {
      candidates = parsed.candidates
        .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
        .map((c) => ({
          canonicalName: String(c.canonicalName ?? name),
          domain: String(c.domain ?? ""),
          bio: String(c.bio ?? ""),
          knownUrls: Array.isArray(c.knownUrls) ? c.knownUrls.map(String).filter(Boolean) : [],
          aliases: Array.isArray(c.aliases) ? c.aliases.map(String).filter(Boolean) : [],
          confidence: (["high", "medium", "low"].includes(String(c.confidence)) ? c.confidence : "medium") as "high" | "medium" | "low",
          isObvious: Boolean(c.isObvious),
          // Attach Wikipedia thumbnail — match only by this candidate's canonicalName
          wikipediaThumb: (() => {
            const canonical = String(c.canonicalName ?? "").toLowerCase();
            const keys = Object.keys(thumbs);
            const match = keys.find((k) => k.toLowerCase() === canonical);
            return match ? thumbs[match] : undefined;
          })(),
        }));
    }

    // Deduplicate by canonicalName (case-insensitive) — keep first occurrence
    const seen = new Set<string>();
    const deduped = candidates.filter((c) => {
      const key = c.canonicalName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({ candidates: deduped });
  } catch (err) {
    console.error("[identify] LLM error:", err);
    return NextResponse.json({ candidates: [] });
  }
}
