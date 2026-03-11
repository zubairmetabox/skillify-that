import * as cheerio from "cheerio";
import { fetchWebPage, type FetchedContent } from "./web-fetcher";

/**
 * Tries to find content-rich pages from a website by:
 * 1. Checking sitemap.xml / sitemap_index.xml
 * 2. Falling back to crawling blog/article links from homepage
 */
export async function fetchWebsiteContentPages(
  baseUrl: string,
  maxPages = 8
): Promise<FetchedContent[]> {
  const origin = extractOrigin(baseUrl);
  if (!origin) return [];

  // Try sitemap
  const sitemapUrls = await discoverFromSitemap(origin, maxPages);

  // If sitemap found nothing, scrape homepage for blog/article links
  const contentUrls =
    sitemapUrls.length > 0
      ? sitemapUrls
      : await discoverFromHomepage(baseUrl, origin, maxPages);

  if (contentUrls.length === 0) return [];

  const results: FetchedContent[] = [];
  for (const url of contentUrls.slice(0, maxPages)) {
    const page = await fetchWebPage(url);
    if (page && page.wordCount > 200) results.push(page);
  }

  return results;
}

async function discoverFromSitemap(origin: string, max: number): Promise<string[]> {
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap`,
  ];

  for (const sitemapUrl of candidates) {
    try {
      const res = await fetch(sitemapUrl, {
        headers: { "User-Agent": "SkillifyBot/1.0" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });

      // Handle sitemap index → pick first child sitemap
      const sitemapRefs = $("sitemap loc")
        .map((_, el) => $(el).text().trim())
        .get();

      let urls: string[] = [];

      if (sitemapRefs.length > 0) {
        // It's an index — follow the first child sitemap
        const childRes = await fetch(sitemapRefs[0], {
          headers: { "User-Agent": "SkillifyBot/1.0" },
          signal: AbortSignal.timeout(8_000),
        });
        if (childRes.ok) {
          const childXml = await childRes.text();
          const $c = cheerio.load(childXml, { xmlMode: true });
          urls = $c("url loc").map((_, el) => $c(el).text().trim()).get();
        }
      } else {
        urls = $("url loc").map((_, el) => $(el).text().trim()).get();
      }

      // Filter to content-looking URLs (blog, article, post, video, episode, tips)
      const contentUrls = urls.filter((u) =>
        /\/(blog|article|post|video|episode|tip|guide|training|learn|resource|podcast)/i.test(u)
      );

      // If no content-specific URLs, take any that aren't home/category/tag pages
      const filtered =
        contentUrls.length > 0
          ? contentUrls
          : urls.filter(
              (u) => !/(category|tag|page\/\d|author|\?|#|\.xml)/.test(u) && u !== origin + "/"
            );

      if (filtered.length > 0) return filtered.slice(0, max);
    } catch {
      // Try next candidate
    }
  }

  return [];
}

async function discoverFromHomepage(
  baseUrl: string,
  origin: string,
  max: number
): Promise<string[]> {
  try {
    const res = await fetch(baseUrl, {
      headers: { "User-Agent": "SkillifyBot/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);

    const links = new Set<string>();
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      let url: string;
      try {
        url = new URL(href, origin).toString();
      } catch {
        return;
      }
      if (
        url.startsWith(origin) &&
        /\/(blog|article|post|tip|guide|training|learn|resource|video|podcast)/i.test(url)
      ) {
        links.add(url);
      }
    });

    return Array.from(links).slice(0, max);
  } catch {
    return [];
  }
}

function extractOrigin(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.origin;
  } catch {
    return null;
  }
}
