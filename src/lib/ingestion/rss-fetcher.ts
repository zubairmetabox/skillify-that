import Parser from "rss-parser";
import type { FetchedContent } from "./web-fetcher";

const parser = new Parser({ timeout: 10_000 });

export async function fetchRssFeed(url: string, maxItems = 20): Promise<FetchedContent[]> {
  try {
    const feed = await parser.parseURL(url);
    const results: FetchedContent[] = [];

    for (const item of (feed.items ?? []).slice(0, maxItems)) {
      const title = item.title ?? "";
      // Strip HTML tags from content
      const rawContent = item.contentSnippet || item.content || item.summary || "";
      const text = `${title}\n\n${rawContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`;

      if (text.length < 50) continue;

      results.push({
        url: item.link ?? url,
        title,
        text: text.slice(0, 10_000),
        wordCount: text.split(/\s+/).length,
        publishedAt: item.pubDate ? new Date(item.pubDate) : null,
        contentType: "rss_entry",
      });
    }

    return results;
  } catch {
    return [];
  }
}
