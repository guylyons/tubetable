import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  fetchYouTubeSearchPayload,
  fetchYouTubeSearchResults,
  fetchYouTubeSuggestions,
  resolveVideoMetadata,
} from "./youtubeApi";

const originalFetch = globalThis.fetch;

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  const fetchMock = mock((input: RequestInfo | URL) => Promise.resolve(handler(String(input))));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function videoRenderer(videoId: string, title = `Video ${videoId}`) {
  return {
    videoId,
    title: { runs: [{ text: title }] },
    ownerText: { runs: [{ text: "Owner" }] },
    lengthText: { simpleText: "4:20" },
    viewCountText: { simpleText: "1,000 views" },
    thumbnail: { thumbnails: [{ url: "small.jpg" }, { url: "large.jpg" }] },
  };
}

function searchPage(initialData: unknown) {
  return `<html><script>var ytInitialData = ${JSON.stringify(initialData)};</script></html>`;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchYouTubeSearchResults", () => {
  test("parses video renderers from the search page", async () => {
    const fetchMock = stubFetch(
      () =>
        new Response(
          searchPage({
            contents: {
              twoColumnSearchResultsRenderer: {
                primaryContents: {
                  sectionListRenderer: {
                    contents: [{ itemSectionRenderer: { contents: [{ videoRenderer: videoRenderer("abc") }] } }],
                  },
                },
              },
            },
          }),
        ),
    );

    const results = await fetchYouTubeSearchResults("rain & thunder");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://www.youtube.com/results?search_query=rain%20%26%20thunder");
    expect(results).toEqual([
      {
        videoId: "abc",
        title: "Video abc",
        channelTitle: "Owner",
        durationText: "4:20",
        viewCountText: "1,000 views",
        thumbnail: "large.jpg",
      },
    ]);
  });

  test("handles braces inside strings, duplicates and incomplete renderers", async () => {
    stubFetch(
      () =>
        new Response(
          searchPage({
            contents: {
              sectionListRenderer: {
                contents: [
                  { videoRenderer: videoRenderer("one", 'Curly {brace} "quoted" title') },
                  { compactVideoRenderer: videoRenderer("one") },
                  { gridVideoRenderer: { videoId: "no-title" } },
                  {
                    videoRenderer: {
                      ...videoRenderer("two"),
                      ownerText: undefined,
                      longBylineText: { simpleText: "Byline" },
                    },
                  },
                ],
              },
            },
          }),
        ),
    );

    const results = await fetchYouTubeSearchResults("q");

    expect(results.map(result => [result.videoId, result.title, result.channelTitle])).toEqual([
      ["one", 'Curly {brace} "quoted" title', "Owner"],
      ["two", "Video two", "Byline"],
    ]);
  });

  test("returns at most ten results", async () => {
    const contents = Array.from({ length: 12 }, (_, index) => ({ videoRenderer: videoRenderer(`v${index}`) }));
    stubFetch(() => new Response(searchPage({ contents: { sectionListRenderer: { contents } } })));

    expect(await fetchYouTubeSearchResults("q")).toHaveLength(10);
  });

  test("throws when YouTube responds with an error", async () => {
    stubFetch(() => new Response("", { status: 429 }));
    await expect(fetchYouTubeSearchResults("q")).rejects.toThrow("YouTube search returned 429.");
  });

  test("throws when the page has no initial data", async () => {
    stubFetch(() => new Response("<html></html>"));
    await expect(fetchYouTubeSearchResults("q")).rejects.toThrow("Unable to parse YouTube search results.");
  });
});

describe("fetchYouTubeSuggestions", () => {
  test("keeps up to six non-blank string suggestions", async () => {
    stubFetch(() => Response.json(["q", ["a", " ", 3, "b", "c", "d", "e", "f", "g"]]));
    expect(await fetchYouTubeSuggestions("q")).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  test("returns nothing for an unexpected payload", async () => {
    stubFetch(() => Response.json({ suggestions: [] }));
    expect(await fetchYouTubeSuggestions("q")).toEqual([]);
  });
});

describe("fetchYouTubeSearchPayload", () => {
  const resultsPage = searchPage({
    contents: { sectionListRenderer: { contents: [{ videoRenderer: videoRenderer("abc") }] } },
  });

  test("returns results when suggestions fail", async () => {
    stubFetch(url => (url.includes("suggestqueries") ? new Response("", { status: 500 }) : new Response(resultsPage)));
    const payload = await fetchYouTubeSearchPayload("q");

    expect(payload.suggestions).toEqual([]);
    expect(payload.results.map(result => result.videoId)).toEqual(["abc"]);
  });

  test("throws when both requests fail", async () => {
    stubFetch(() => new Response("", { status: 503 }));
    await expect(fetchYouTubeSearchPayload("q")).rejects.toThrow("503");
  });
});

describe("resolveVideoMetadata", () => {
  test("maps oEmbed data to a search result", async () => {
    const fetchMock = stubFetch(() =>
      Response.json({ title: "Title", author_name: "Author", thumbnail_url: "thumb.jpg" }),
    );

    expect(await resolveVideoMetadata("abc")).toEqual({
      videoId: "abc",
      title: "Title",
      channelTitle: "Author",
      thumbnail: "thumb.jpg",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabc&format=json",
    );
  });

  test("throws on incomplete metadata", async () => {
    stubFetch(() => Response.json({ title: "Title" }));
    await expect(resolveVideoMetadata("abc")).rejects.toThrow("Incomplete metadata returned by YouTube.");
  });

  test("throws when the video can't be resolved", async () => {
    stubFetch(() => new Response("", { status: 404 }));
    await expect(resolveVideoMetadata("abc")).rejects.toThrow("Unable to resolve the requested YouTube video.");
  });
});
