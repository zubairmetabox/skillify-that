import { groq, GROQ_MODELS } from "@/lib/groq";

export type IdentityResolution = {
  canonicalName: string;
  aliases: string[];
  likelySocialHandles: string[];
  likelyWebsites: string[];
  likelyYouTubeChannels: string[];
  likelyPodcasts: string[];
  knownBrands: string[];
  disambiguation: string;
};

/**
 * Uses Groq LLM to resolve known aliases, handles, and official properties
 * for a given expert name + domain. This is a knowledge-based seed — real
 * discovery still validates via live sources.
 */
export async function resolveExpertIdentity(
  expertName: string,
  domain: string
): Promise<IdentityResolution> {
  const prompt = `You are an expert identity resolver. Given a public figure's name and domain of expertise, return a structured JSON object with everything you know about their public digital presence.

Expert: ${expertName}
Domain: ${domain}

Return ONLY valid JSON with this exact structure:
{
  "canonicalName": "full legal/professional name",
  "aliases": ["list of known nicknames, handles, or brand names"],
  "likelySocialHandles": ["@handle1", "@handle2"],
  "likelyWebsites": ["https://..."],
  "likelyYouTubeChannels": ["channel name or URL if known"],
  "likelyPodcasts": ["podcast name if known"],
  "knownBrands": ["brand or company names they are associated with"],
  "disambiguation": "brief note if this person might be confused with others"
}

Be conservative — only include what you are highly confident about for this specific person. If unsure, omit.`;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODELS.balanced,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Partial<IdentityResolution>;

    return {
      canonicalName: parsed.canonicalName ?? expertName,
      aliases: parsed.aliases ?? [],
      likelySocialHandles: parsed.likelySocialHandles ?? [],
      likelyWebsites: parsed.likelyWebsites ?? [],
      likelyYouTubeChannels: parsed.likelyYouTubeChannels ?? [],
      likelyPodcasts: parsed.likelyPodcasts ?? [],
      knownBrands: parsed.knownBrands ?? [],
      disambiguation: parsed.disambiguation ?? "",
    };
  } catch {
    return {
      canonicalName: expertName,
      aliases: [],
      likelySocialHandles: [],
      likelyWebsites: [],
      likelyYouTubeChannels: [],
      likelyPodcasts: [],
      knownBrands: [],
      disambiguation: "",
    };
  }
}
