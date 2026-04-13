import { fetchYouTubeSearchPayload, resolveVideoMetadata } from "./_shared/youtubeApi";

type FunctionEvent = {
  path?: string;
  rawUrl?: string;
  queryStringParameters?: Record<string, string> | null;
};

function json(data: unknown, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Cache-Control": "public, max-age=120, stale-while-revalidate=300",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(data),
  };
}

function routeFromEvent(event: FunctionEvent) {
  const routeFromQuery = event.queryStringParameters?.route?.trim();
  if (routeFromQuery) {
    return routeFromQuery;
  }

  const fallbackUrl = event.rawUrl ?? `https://example.invalid${event.path ?? ""}`;
  const pathname = new URL(fallbackUrl).pathname;
  return pathname.split("/").filter(Boolean).at(-1) ?? "";
}

function getQueryParam(event: FunctionEvent, key: string) {
  const fromEvent = event.queryStringParameters?.[key]?.trim();
  if (fromEvent) {
    return fromEvent;
  }

  if (!event.rawUrl) {
    return "";
  }

  return new URL(event.rawUrl).searchParams.get(key)?.trim() ?? "";
}

export async function handler(event: FunctionEvent) {
  const route = routeFromEvent(event);

  if (route === "search") {
    const query = getQueryParam(event, "q");

    if (query.length < 2) {
      return json({ results: [], suggestions: [] });
    }

    try {
      return json(await fetchYouTubeSearchPayload(query));
    } catch (error) {
      return json(
        {
          error: error instanceof Error ? error.message : "Search failed.",
          results: [],
          suggestions: [],
        },
        502,
      );
    }
  }

  if (route === "video") {
    const videoId = getQueryParam(event, "videoId");

    if (!/^[\w-]{11}$/.test(videoId)) {
      return json({ error: "A valid YouTube video ID is required." }, 400);
    }

    try {
      return json({ result: await resolveVideoMetadata(videoId) });
    } catch (error) {
      return json(
        {
          error: error instanceof Error ? error.message : "Could not resolve that video.",
        },
        502,
      );
    }
  }

  return json({ error: "Unknown YouTube API route." }, 404);
}
