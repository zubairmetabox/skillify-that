import { DiscoveredSource } from "@/types";
import { checkRobotsTxt } from "./robots";

/**
 * Heuristically derives candidate web sources for an expert.
 * Uses their name + domain to produce likely official URLs to check.
 */
export async function discoverWebSources(
  expertName: string,
  domain: string,
  knownUrls: string[] = []
): Promise<DiscoveredSource[]> {
  const sources: DiscoveredSource[] = [];
  const slug = expertName.toLowerCase().replace(/\s+/g, "");
  const firstName = expertName.split(" ")[0].toLowerCase();

  const candidateUrls = [
    ...knownUrls,
    `https://www.${slug}.com`,
    `https://${slug}.com`,
    `https://www.${firstName}cardone.com`, // example pattern
  ];

  const uniqueUrls = [...new Set(candidateUrls)];

  for (const url of uniqueUrls) {
    try {
      const robots = await checkRobotsTxt(url);
      const isReachable = await pingUrl(url);

      if (!isReachable) continue;

      sources.push({
        url,
        label: `Website: ${new URL(url).host}`,
        sourceType: "WEBSITE",
        tier: knownUrls.includes(url) ? "OFFICIAL" : "FIRST_PARTY",
        authorityScore: knownUrls.includes(url) ? 0.95 : 0.7,
        relevanceScore: 0.75,
        priorityScore: knownUrls.includes(url) ? 0.9 : 0.65,
        complianceStatus: robots.allowed ? "ALLOWED" : "DISALLOWED",
        complianceNote: robots.allowed
          ? "robots.txt permits crawling"
          : "robots.txt disallows automated access",
        robotsAllowed: robots.allowed,
      });
    } catch {
      // skip unreachable URLs
    }
  }

  return sources;
}

async function pingUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    return res.ok || res.status === 405; // 405 = method not allowed but server is alive
  } catch {
    return false;
  }
}
