import { serve } from "bun";
import index from "./index.html";
import { fetchYouTubeSearchPayload, resolveVideoMetadata } from "../netlify/functions/_shared/youtubeApi";

type YouTubeSearchPayload = {
  results: Array<{
    videoId: string;
    title: string;
    channelTitle: string;
    durationText?: string;
    viewCountText?: string;
    thumbnail: string;
  }>;
  suggestions: string[];
};

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    headers: {
      "Cache-Control": "public, max-age=120, stale-while-revalidate=300",
    },
    ...init,
  });
}

const server = serve({
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/api/youtube/search": {
      async GET(request) {
        const url = new URL(request.url);
        const query = url.searchParams.get("q")?.trim() ?? "";

        if (query.length < 2) {
          return json({ results: [], suggestions: [] } satisfies YouTubeSearchPayload);
        }

        try {
          const payload = await fetchYouTubeSearchPayload(query);
          return json(payload);
        } catch (error) {
          return json(
            {
              error: error instanceof Error ? error.message : "Search failed.",
              results: [],
              suggestions: [],
            },
            { status: 502 },
          );
        }
      },
    },

    "/api/youtube/video": {
      async GET(request) {
        const url = new URL(request.url);
        const videoId = url.searchParams.get("videoId")?.trim() ?? "";

        if (!/^[\w-]{11}$/.test(videoId)) {
          return json({ error: "A valid YouTube video ID is required." }, { status: 400 });
        }

        try {
          const result = await resolveVideoMetadata(videoId);
          return json({ result });
        } catch (error) {
          return json(
            {
              error: error instanceof Error ? error.message : "Could not resolve that video.",
            },
            { status: 502 },
          );
        }
      },
    },

    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
