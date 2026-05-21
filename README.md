# TubeTable

TubeTable is a small browser app for building simple YouTube video mixes. Add a few videos, play them together, and balance each one like a tiny mixer.

It is built with Bun, React, and Tailwind. The app runs locally with a Bun server, and the YouTube search route can also run as a Netlify function.

## What it does

- Search YouTube by title, channel, or general mood
- Paste a YouTube URL to add a video directly
- Build a mix with up to five video channels
- Adjust each channel volume plus the overall master volume
- Mute, solo, pause, loop, remove, and reorder channels
- Save mixes in local browser storage
- Pick up where you left off, including playback position
- Switch between light and dark mode

## Getting started

Install Bun if you do not already have it:

```sh
curl -fsSL https://bun.sh/install | bash
```

Then install dependencies:

```sh
bun install
```

Run the app locally:

```sh
bun run dev
```

Open the local URL that Bun prints, usually:

```txt
http://localhost:3000
```

## Scripts

```sh
bun run dev
```

Starts the local development server with hot reload.

```sh
bun run build
```

Builds the frontend into `dist/`.

```sh
bun run start
```

Runs the app in production mode with Bun.

## How the app is laid out

```txt
src/
  App.tsx                    main app state and behavior
  index.ts                   local Bun server entry
  index.html                 frontend entry
  index.css                  Tailwind and app styles
  components/                UI sections and controls
  lib/                       mix storage, channel logic, YouTube helpers
  types.ts                   shared app types

netlify/functions/
  youtube.ts                 Netlify API entry
  _shared/youtubeApi.ts      YouTube search and metadata scraping helpers
```

## YouTube search

The app has two YouTube API-style routes:

```txt
/api/youtube/search?q=...
/api/youtube/video?videoId=...
```

Locally, these are served by `src/server.ts`. On Netlify, `netlify.toml` redirects those paths to the `youtube` function.

The search helper scrapes public YouTube page data instead of using a YouTube API key, so there is no extra setup needed for normal local use. If YouTube changes its page shape or blocks the request, search may fail until the parser is updated.

## Data storage

Saved mixes live in the browser's local storage. There is no account system and no backend database. Clearing site data will clear saved mixes.

## Deployment

This repo includes a Netlify config. Build the frontend with:

```sh
bun run build
```

Netlify should serve `dist/` and route `/api/youtube/*` through the function in `netlify/functions/youtube.ts`.

## Notes

This is intentionally lightweight. It is more of a fun mixing table for YouTube clips than a full audio workstation. Expect browser autoplay rules, YouTube iframe behavior, and network availability to affect playback sometimes.
