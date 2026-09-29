# API Reference

Tubetable exposes a small JSON API from the Bun server in `src/server.ts`.
The frontend uses these routes to search YouTube and to resolve pasted YouTube
links before adding them to a mix.

## Base URL

Local development:

```txt
http://localhost:3000
```

The frontend calls these routes as relative paths, so any production deployment
must serve the API from the same origin or provide equivalent rewrites.

## Common Behavior

All API responses are JSON.

Successful and error responses include this cache header:

```txt
Cache-Control: public, max-age=120, stale-while-revalidate=300
```

The server reads public YouTube pages and oEmbed responses. It does not require
a YouTube API key, but upstream page structure or availability can affect these
routes.

## Data Types

```ts
type YouTubeSearchResult = {
  videoId: string;
  title: string;
  channelTitle: string;
  durationText?: string;
  viewCountText?: string;
  thumbnail: string;
};

type YouTubeSearchPayload = {
  results: YouTubeSearchResult[];
  suggestions: string[];
};
```

`durationText` and `viewCountText` are available for search results when
YouTube includes them. Video metadata resolved through oEmbed does not include
those optional fields.

## GET /api/youtube/search

Searches YouTube and returns up to 10 video results plus up to 6 search
suggestions.

### Query Parameters

| Name | Required | Description                                               |
| ---- | -------- | --------------------------------------------------------- |
| `q`  | Yes      | Search query. Leading and trailing whitespace is ignored. |

Queries shorter than 2 characters return an empty successful payload without
calling YouTube.

### Example Request

```sh
curl "http://localhost:3000/api/youtube/search?q=lofi%20beats"
```

### 200 Response

```json
{
  "results": [
    {
      "videoId": "jfKfPfyJRdk",
      "title": "lofi hip hop radio beats to relax/study to",
      "channelTitle": "Lofi Girl",
      "durationText": "LIVE",
      "viewCountText": "12K watching",
      "thumbnail": "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg"
    }
  ],
  "suggestions": ["lofi beats", "lofi beats to study to"]
}
```

The exact result order, titles, counters, and thumbnail URLs come from YouTube
and can change between requests.

### 502 Response

Returned when both YouTube search results and suggestions fail.

```json
{
  "error": "Unable to parse YouTube search results.",
  "results": [],
  "suggestions": []
}
```

If only one upstream source fails, the route still returns `200` with the data
that was available.

## GET /api/youtube/video

Resolves one YouTube video ID into metadata. The app uses this when a user
pastes a YouTube URL instead of selecting a search result.

### Query Parameters

| Name      | Required | Description                                                                |
| --------- | -------- | -------------------------------------------------------------------------- |
| `videoId` | Yes      | An 11-character YouTube video ID containing letters, numbers, `_`, or `-`. |

### Example Request

```sh
curl "http://localhost:3000/api/youtube/video?videoId=jfKfPfyJRdk"
```

### 200 Response

```json
{
  "result": {
    "videoId": "jfKfPfyJRdk",
    "title": "lofi hip hop radio beats to relax/study to",
    "channelTitle": "Lofi Girl",
    "thumbnail": "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg"
  }
}
```

### 400 Response

Returned when `videoId` is missing or does not match the expected YouTube video
ID format.

```json
{
  "error": "A valid YouTube video ID is required."
}
```

### 502 Response

Returned when YouTube oEmbed does not resolve the video or returns incomplete
metadata.

```json
{
  "error": "Unable to resolve the requested YouTube video."
}
```

## Related Client Behavior

The frontend extracts video IDs from common YouTube URL formats before calling
`/api/youtube/video`. These include standard watch URLs, short `youtu.be` URLs,
embed URLs, shorts URLs, and live URLs.
