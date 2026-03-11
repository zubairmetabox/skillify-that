import * as cheerio from "cheerio";

export type FetchedContent = {
  url: string;
  title: string;
  text: string;
  wordCount: number;
  publishedAt: Date | null;
  contentType: string;
};

/**
 * Fetches a web page and extracts clean text using cheerio.
 */
export async function fetchWebPage(url: string): Promise<FetchedContent | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "SkillifyBot/1.0 (educational content indexer; contact@skillify.dev)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove noise
    $("script, style, nav, footer, header, aside, iframe, noscript, [aria-hidden=true]").remove();

    const title = $("title").first().text().trim() || $("h1").first().text().trim() || url;

    // Try article/main first, fallback to body
    const contentEl = $("article, main, [role=main]").first();
    const text = (contentEl.length ? contentEl : $("body"))
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 100) return null;

    // Attempt to parse publish date from meta tags
    const dateStr =
      $('meta[property="article:published_time"]').attr("content") ||
      $('meta[name="date"]').attr("content") ||
      $('time[datetime]').first().attr("datetime") ||
      null;

    const publishedAt = dateStr ? new Date(dateStr) : null;

    return {
      url,
      title,
      text: text.slice(0, 20_000), // cap at 20k chars per page
      wordCount: text.split(/\s+/).length,
      publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
      contentType: "webpage",
    };
  } catch {
    return null;
  }
}
