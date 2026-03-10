/**
 * Checks robots.txt for a given URL and returns whether automated access is allowed.
 */
export async function checkRobotsTxt(url: string): Promise<{
  allowed: boolean;
  robotsTxtUrl: string;
  disallowedPaths: string[];
}> {
  const parsed = new URL(url);
  const robotsTxtUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;

  try {
    const res = await fetch(robotsTxtUrl, {
      headers: { "User-Agent": "SkillifyBot/1.0 (+https://skillify-that.com/bot)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      // No robots.txt = crawling allowed by convention
      return { allowed: true, robotsTxtUrl, disallowedPaths: [] };
    }

    const text = await res.text();
    const lines = text.split("\n");
    const disallowedPaths: string[] = [];
    let inRelevantAgent = false;
    let globalDisallowAll = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith("User-agent:")) {
        const agent = line.replace("User-agent:", "").trim();
        inRelevantAgent = agent === "*" || agent.toLowerCase().includes("skillify");
      }
      if (inRelevantAgent && line.startsWith("Disallow:")) {
        const path = line.replace("Disallow:", "").trim();
        if (path === "/") globalDisallowAll = true;
        if (path) disallowedPaths.push(path);
      }
    }

    const targetPath = parsed.pathname || "/";
    const blocked =
      globalDisallowAll ||
      disallowedPaths.some(
        (p) => p !== "/" && targetPath.startsWith(p)
      );

    return {
      allowed: !blocked,
      robotsTxtUrl,
      disallowedPaths,
    };
  } catch {
    return { allowed: true, robotsTxtUrl, disallowedPaths: [] };
  }
}
