# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `bun run dev` serves on http://localhost:3000 with hot reload. `PORT` overrides the port.
- `bun test`. Run one file with `bun test src/lib/youtube.test.ts` or one test by name with `bun test -t "name"`.
- `bun run typecheck` runs TypeScript 7 (`tsc --noEmit`). `baseUrl` is not allowed in tsconfig; `paths` resolves relative to the tsconfig.
- `bun run format` formats with Prettier (printWidth 120, `arrowParens: avoid`). A PostToolUse hook already formats every file Claude edits.
- CodeGraph: `codegraph context "<task>"` gathers context before editing, and `codegraph sync` updates the index after changes.
- `/verify` runs tests, typecheck and format check, then checks the UI in a browser.

## Architecture

- This is a local browser tool for mixing up to 5 YouTube videos. It is not deployed.
- `src/server.ts` runs `Bun.serve`. It serves the React app and `/api/youtube/{search,video}` (documented in `docs/api.md`). Those routes scrape public YouTube pages, so they need no API key and no env vars.
- Playback goes only through YouTube iframes (`src/lib/youtube.ts`). Volume, mute and solo go through the iframe player API, and mix logic lives in `src/lib/mixChannels.ts`.
- `src/components/PlayerLayer.tsx` hosts every iframe in one absolutely positioned layer and lays each over its slot (`data-player-slot`: the stage for the focused channel, the card thumbnail otherwise). **Never move an iframe in the DOM**: that reloads it and breaks its YouTube API connection. That is why players render sorted by channel id, not channel order.
- Each channel plays or pauses on its own (`channel.paused`); there is no global transport flag. Play/pause commands are also sent straight to the player inside click handlers so the browser counts them as user gestures. Everything loads paused.
- YouTube's `seekTo` starts a cued or paused video. Seek through `seekPlayer`, which pauses again when the channel should stay paused.
- `src/App.tsx` owns all state as one `MixLibrary` (the draft plus saved mixes). Saved mixes autosave: edits go straight into the library entry through `src/lib/mixLibrary.ts`, and only the unsaved draft has a Save button.
- The library is stored in localStorage (`src/lib/mixStorage.ts`), so field changes must still load old saved mixes by filling in defaults. `readStoredMixState` also migrates the pre-autosave `draftCache` shape.
- Styling is Tailwind v4 with theme tokens (`bg-panel`, `text-ink`, `bg-accent`...) defined as CSS variables in `src/index.css`. The Grey (default, Ableton-like), Dark and Light themes only swap those variables via `data-theme` on `<html>`, so components never branch on the theme. Shared class strings live in `src/components/ui.ts`. Icons come from `lucide-react`. MUI is **not** installed.
- `src/components/uiContracts.test.ts` reads `.tsx` files as text and checks for specific class names and markup. Renaming classes or restructuring JSX can break it without any behavior change.

## Audio effects (lowpass filter, etc.)

- A multi-effect DSP system existed from June to July 2026 and was removed (jj change `qnzmnsnq`). It needed a server audio proxy that streamed YouTube audio into Web Audio alongside the iframe. That caused sync, format and backpressure bugs. Don't reintroduce it piecemeal.
- The agreed scope is `docs/lofi-lowpass-effect.md`: one lowpass `BiquadFilterNode`, a toggle and a cutoff slider, with no diagnostics and no proxy.
- **Unresolved blocker:** Web Audio can't read audio from a cross-origin YouTube iframe, so the plan has no source node to filter. Settle how audio reaches Web Audio with the user before writing effect code.
