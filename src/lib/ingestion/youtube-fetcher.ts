import type { FetchedContent } from "./web-fetcher";

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Given a YouTube channel URL, fetches recent video metadata and descriptions.
 * Uses the YouTube Data API v3 (API key only — no OAuth needed for public content).
 */
export async function fetchYouTubeChannelContent(
  channelUrl: string,
  maxVideos = 20
): Promise<FetchedContent[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  try {
    // Extract channel ID or handle from URL
    const channelId = await resolveChannelId(channelUrl, apiKey);
    if (!channelId) return [];

    // Get uploads playlist ID
    const channelRes = await fetch(
      `${YT_API_BASE}/channels?part=contentDetails,snippet&id=${channelId}&key=${apiKey}`
    );
    if (!channelRes.ok) return [];
    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];
    if (!channel) return [];

    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) return [];

    // Get recent videos from uploads playlist
    const playlistRes = await fetch(
      `${YT_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxVideos}&key=${apiKey}`
    );
    if (!playlistRes.ok) return [];
    const playlistData = await playlistRes.json();
    const items = playlistData.items ?? [];

    const results: FetchedContent[] = [];

    for (const item of items) {
      const snippet = item.snippet;
      const videoId = snippet?.resourceId?.videoId;
      if (!videoId) continue;

      const title = snippet.title ?? "";
      const description = snippet.description ?? "";
      const publishedAt = snippet.publishedAt ? new Date(snippet.publishedAt) : null;

      // Combine title + description as content (transcripts need OAuth)
      const text = `${title}\n\n${description}`.trim();
      if (text.length < 30) continue;

      results.push({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title,
        text,
        wordCount: text.split(/\s+/).length,
        publishedAt,
        contentType: "youtube_video",
      });
    }

    return results;
  } catch {
    return [];
  }
}

async function resolveChannelId(url: string, apiKey: string): Promise<string | null> {
  // Direct channel ID: /channel/UC...
  const idMatch = url.match(/\/channel\/(UC[\w-]+)/);
  if (idMatch) return idMatch[1];

  // Handle: /@handle or /c/handle or /user/handle
  const handleMatch = url.match(/\/@([\w.-]+)/) ||
    url.match(/\/c\/([\w.-]+)/) ||
    url.match(/\/user\/([\w.-]+)/);

  if (handleMatch) {
    const handle = handleMatch[1];
    const res = await fetch(
      `${YT_API_BASE}/channels?part=id&forHandle=${handle}&key=${apiKey}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0]?.id ?? null;
  }

  return null;
}
