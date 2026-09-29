---
name: verify
description: Verify a tubetable change end to end — tests, typecheck, format, then check the affected UI in a real browser at phone and desktop widths. Use after implementing a change and before calling it done or committing.
---

Run these in order and stop at the first failure. Report what actually happened, including the failure output.

1. `bun test`
2. `bun run typecheck`
3. `bun run format:check`
4. If the change touches UI (`src/components/`, `src/App.tsx`, `src/index.css`) or playback (`src/lib/youtube.ts`):
   - Start the server in the background with `PORT=3100 bun run dev`. Use a non-default port because the user may already have one running on 3000.
   - Open `http://localhost:3100` with whichever browser tool is available (Chrome DevTools MCP or Claude in Chrome).
   - Check the changed behavior at **390px wide** (phone) and **1280px wide** (desktop). At phone width, confirm there's no horizontal scroll: `document.documentElement.scrollWidth <= window.innerWidth`.
   - Check both light and dark themes if the change touched colors or classes.
   - If playback is involved, add a video through the search box, press play and confirm the tile and mixer strip react. YouTube embeds can take a few seconds to load.
   - Check the console for errors.
   - Stop the dev server when you're done.
5. Summarize: which checks passed, what you looked at in the browser, and anything you couldn't verify.

$ARGUMENTS
