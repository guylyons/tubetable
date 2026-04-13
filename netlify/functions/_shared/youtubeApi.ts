const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

export type YouTubeSearchResult = {
  videoId: string;
  title: string;
  channelTitle: string;
  durationText?: string;
  viewCountText?: string;
  thumbnail: string;
};

export type YouTubeSearchPayload = {
  results: YouTubeSearchResult[];
  suggestions: string[];
};

function textFromRenderer(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  if (typeof record.simpleText === "string") {
    return record.simpleText;
  }

  if (Array.isArray(record.runs)) {
    return record.runs
      .map(item => {
        if (!item || typeof item !== "object") {
          return "";
        }

        return typeof (item as Record<string, unknown>).text === "string"
          ? ((item as Record<string, unknown>).text as string)
          : "";
      })
      .join("");
  }

  return "";
}

function extractJsonObject(source: string, marker: string) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const start = source.indexOf("{", markerIndex + marker.length);
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let stringDelimiter = "";

  for (let index = start; index < source.length; index += 1) {
    const character = source[index]!;

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (character === "\\") {
        escapeNext = true;
        continue;
      }

      if (character === stringDelimiter) {
        inString = false;
        stringDelimiter = "";
      }

      continue;
    }

    if (character === `"` || character === `'` || character === "`") {
      inString = true;
      stringDelimiter = character;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character !== "}") {
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }

  return null;
}

function extractInitialData(html: string) {
  const markers = ["var ytInitialData = ", 'window["ytInitialData"] = ', "window['ytInitialData'] = ", "ytInitialData = "];

  for (const marker of markers) {
    const jsonString = extractJsonObject(html, marker);
    if (!jsonString) {
      continue;
    }

    return JSON.parse(jsonString);
  }

  throw new Error("Unable to parse YouTube search results.");
}

function getValueAtPath(root: unknown, path: Array<string | number>): unknown {
  let current = root;

  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current) || segment >= current.length) {
        return undefined;
      }

      current = current[segment];
      continue;
    }

    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function extractPrimarySearchItems(initialData: unknown) {
  const candidatePaths: Array<Array<string | number>> = [
    ["contents", "twoColumnSearchResultsRenderer", "primaryContents", "sectionListRenderer", "contents"],
    ["contents", "sectionListRenderer", "contents"],
  ];

  for (const path of candidatePaths) {
    const value = getValueAtPath(initialData, path);
    if (Array.isArray(value)) {
      return value as unknown[];
    }
  }

  return [];
}

function collectVideoRenderers(root: unknown) {
  const renderers: Record<string, unknown>[] = [];
  const visited = new Set<object>();

  function visit(value: unknown) {
    if (!value || typeof value !== "object") {
      return;
    }

    if (visited.has(value as object)) {
      return;
    }

    visited.add(value as object);

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    const record = value as Record<string, unknown>;
    if (record.videoRenderer && typeof record.videoRenderer === "object") {
      renderers.push(record.videoRenderer as Record<string, unknown>);
    }

    if (record.compactVideoRenderer && typeof record.compactVideoRenderer === "object") {
      renderers.push(record.compactVideoRenderer as Record<string, unknown>);
    }

    if (record.gridVideoRenderer && typeof record.gridVideoRenderer === "object") {
      renderers.push(record.gridVideoRenderer as Record<string, unknown>);
    }

    for (const nestedValue of Object.values(record)) {
      visit(nestedValue);
    }
  }

  visit(root);
  return renderers;
}

function mapVideoRenderer(renderer: Record<string, unknown>): YouTubeSearchResult | null {
  const videoId = typeof renderer.videoId === "string" ? renderer.videoId : "";
  const title = textFromRenderer(renderer.title);
  const channelTitle = textFromRenderer(renderer.ownerText) || textFromRenderer(renderer.longBylineText);
  const durationText = textFromRenderer(renderer.lengthText);
  const viewCountText = textFromRenderer(renderer.viewCountText);

  const thumbnailRecord =
    renderer.thumbnail && typeof renderer.thumbnail === "object"
      ? (renderer.thumbnail as Record<string, unknown>)
      : undefined;
  const thumbnails = Array.isArray(thumbnailRecord?.thumbnails)
    ? (thumbnailRecord?.thumbnails as Array<Record<string, unknown>>)
    : [];
  const thumbnail = thumbnails.at(-1)?.url;

  if (!videoId || !title || !channelTitle || typeof thumbnail !== "string") {
    return null;
  }

  return {
    videoId,
    title,
    channelTitle,
    durationText: durationText || undefined,
    viewCountText: viewCountText || undefined,
    thumbnail,
  };
}

export async function fetchYouTubeSearchResults(query: string) {
  const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`YouTube search returned ${response.status}.`);
  }

  const html = await response.text();
  const initialData = extractInitialData(html);
  const primaryItems = extractPrimarySearchItems(initialData);
  const renderers = collectVideoRenderers(primaryItems.length > 0 ? primaryItems : initialData);
  const seen = new Set<string>();

  return renderers
    .map(mapVideoRenderer)
    .filter((item): item is YouTubeSearchResult => item !== null)
    .filter(item => {
      if (seen.has(item.videoId)) {
        return false;
      }

      seen.add(item.videoId);
      return true;
    })
    .slice(0, 10);
}

export async function fetchYouTubeSuggestions(query: string) {
  const response = await fetch(
    `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`,
    {
      headers: {
        "accept-language": "en-US,en;q=0.9",
        "user-agent": USER_AGENT,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`YouTube suggestions returned ${response.status}.`);
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[1])) {
    return [];
  }

  return data[1]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 6);
}

export async function fetchYouTubeSearchPayload(query: string): Promise<YouTubeSearchPayload> {
  const [suggestions, results] = await Promise.allSettled([
    fetchYouTubeSuggestions(query),
    fetchYouTubeSearchResults(query),
  ]);

  const resolvedSuggestions = suggestions.status === "fulfilled" ? suggestions.value : [];
  const resolvedResults = results.status === "fulfilled" ? results.value : [];

  if (resolvedSuggestions.length === 0 && resolvedResults.length === 0) {
    if (suggestions.status === "rejected") {
      throw suggestions.reason;
    }

    if (results.status === "rejected") {
      throw results.reason;
    }
  }

  return {
    suggestions: resolvedSuggestions,
    results: resolvedResults,
  };
}

export async function resolveVideoMetadata(videoId: string) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error("Unable to resolve the requested YouTube video.");
  }

  const data = (await response.json()) as {
    author_name?: string;
    thumbnail_url?: string;
    title?: string;
  };

  if (!data.title || !data.author_name || !data.thumbnail_url) {
    throw new Error("Incomplete metadata returned by YouTube.");
  }

  return {
    videoId,
    title: data.title,
    channelTitle: data.author_name,
    thumbnail: data.thumbnail_url,
  } satisfies YouTubeSearchResult;
}
