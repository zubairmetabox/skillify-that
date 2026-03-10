import { DiscoveredSource } from "@/types";

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Searches YouTube for a channel belonging to the expert and returns
 * discovered source endpoints.
 */
export async function discoverYouTubeSources(
  expertName: string,
  domain: string
): Promise<DiscoveredSource[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return [];
  }

  const sources: DiscoveredSource[] = [];

  try {
    // Search for channel
    const searchUrl = new URL(`${YT_API_BASE}/search`);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", `${expertName} ${domain}`);
    searchUrl.searchParams.set("type", "channel");
    searchUrl.searchParams.set("maxResults", "5");
    searchUrl.searchParams.set("key", apiKey);

    const res = await fetch(searchUrl.toString());
    if (!res.ok) return sources;

    const data = await res.json();
    const items: YoutubeSearchItem[] = data.items ?? [];

    for (const item of items) {
      const channelId = item.snippet.channelId;
      const channelTitle = item.snippet.channelTitle;
      const channelUrl = `https://www.youtube.com/channel/${channelId}`;
      const isLikelyOfficial = channelTitle
        .toLowerCase()
        .includes(expertName.split(" ")[0].toLowerCase());

      sources.push({
        url: channelUrl,
        label: `YouTube: ${channelTitle}`,
        sourceType: "YOUTUBE_CHANNEL",
        tier: isLikelyOfficial ? "FIRST_PARTY" : "SECONDARY",
        authorityScore: isLikelyOfficial ? 0.85 : 0.5,
        relevanceScore: 0.8,
        priorityScore: isLikelyOfficial ? 0.82 : 0.5,
        complianceStatus: "ALLOWED",
        complianceNote: "YouTube Data API v3 — API-first compliant",
        robotsAllowed: true,
      });
    }
  } catch {
    // Swallow errors; caller handles partial results
  }

  return sources;
}

/**
 * Given a YouTube channel URL, fetches recent video metadata.
 * Used in Milestone 2 ingestion.
 */
export async function getChannelVideos(
  channelId: string,
  maxResults = 50
): Promise<YoutubeVideoItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const url = new URL(`${YT_API_BASE}/search`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "date");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json();
  return data.items ?? [];
}

export type YoutubeSearchItem = {
  id: { channelId?: string; videoId?: string };
  snippet: {
    channelId: string;
    channelTitle: string;
    title: string;
    description: string;
    publishedAt: string;
  };
};

export type YoutubeVideoItem = {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    channelId: string;
    channelTitle: string;
  };
};
