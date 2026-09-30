import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..", "..");

function readSource(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

const componentFiles = readdirSync(join(repoRoot, "src/components")).filter(name => name.endsWith(".tsx"));

describe("UI interaction contracts", () => {
  test("keeps every YouTube iframe in one layer and moves it over its slot, so focus changes never reload a video", () => {
    const layer = readSource("src/components/PlayerLayer.tsx");

    expect(layer).toContain('export const PLAYER_SLOT_ATTRIBUTE = "data-player-slot"');
    expect(readSource("src/components/Stage.tsx")).toContain("[PLAYER_SLOT_ATTRIBUTE]: channel.id");
    expect(readSource("src/components/ChannelTray.tsx")).toContain("[PLAYER_SLOT_ATTRIBUTE]: channel.id");
    for (const name of componentFiles.filter(name => name !== "PlayerLayer.tsx")) {
      expect(`${name}: ${readSource(`src/components/${name}`).includes("new YT.Player")}`).toBe(`${name}: false`);
    }
  });

  test("renders players in a fixed order, since React moving an iframe to follow a channel reorder reloads it", () => {
    expect(readSource("src/components/PlayerLayer.tsx")).toContain(
      "[...channels].sort((left, right) => left.id.localeCompare(right.id))",
    );
  });

  test("keeps the YouTube iframe's own buttons away from the keyboard and screen readers", () => {
    expect(readSource("src/components/PlayerLayer.tsx")).toMatch(/<div inert[^>]*>\s*<div ref=\{containerRef\}/);
  });

  test("renders stage controls as a sibling of the video slot so they stack above the video layer", () => {
    const stage = readSource("src/components/Stage.tsx");

    expect(stage).toContain("A sibling of the slot so it stacks above the video layer");
    expect(stage).toContain('expanded ? "fixed inset-0 z-50" : "absolute inset-0 z-20"');
  });

  test("keeps the stage at the video's own 16:9 shape instead of capping its height", () => {
    const stage = readSource("src/components/Stage.tsx");

    expect(stage).toContain('"relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg"');
    expect(stage).not.toContain("max-h-");
  });

  test("lets the sidebar take its natural height beside both the stage and the channels", () => {
    const app = readSource("src/App.tsx");

    expect(app).not.toContain("contain:size");
    expect(readSource("src/components/SessionsPanel.tsx")).not.toContain("max-h-");
  });

  test("uses a range input with a spoken time for the stage scrubber", () => {
    const stage = readSource("src/components/Stage.tsx");

    expect(stage).toContain("aria-label={`Seek ${channel.video.title}`}");
    expect(stage).toContain("aria-valuetext={");
  });

  test("starts and stops players inside click handlers so browsers allow the sound", () => {
    const app = readSource("src/App.tsx");

    expect(app).toContain("player?.playVideo()");
    expect(app).toContain("players.get(channel.id)?.playVideo()");
  });

  test("uses a single-line search input so Enter submits the add form", () => {
    const source = readSource("src/components/SearchBar.tsx");

    expect(source).not.toContain("<textarea");
    expect(source).toContain('type="search"');
    expect(source).toContain('enterKeyHint="go"');
  });

  test("lets the keyboard move through, pick and dismiss search results", () => {
    const source = readSource("src/components/SearchBar.tsx");

    expect(source).toContain('role="combobox"');
    expect(source).toContain("aria-activedescendant");
    expect(source).toContain('"ArrowDown"');
    expect(source).toContain('"Escape"');
    expect(source).toContain("Add top result");
  });

  test("themes through CSS tokens, so no component branches on the theme", () => {
    const css = readSource("src/index.css");

    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain(':root[data-theme="light"]');
    for (const name of componentFiles) {
      const source = readSource(`src/components/${name}`);
      expect(`${name}: ${source.includes("isDarkMode") || source.includes("dark:")}`).toBe(`${name}: false`);
    }
  });

  test("places menus with fixed positioning so scrolling lists cannot clip them", () => {
    expect(readSource("src/components/Menu.tsx")).toContain('className="fixed z-50');
  });

  test("renders the stage, then the channels, then the sidebar, so phones reach the music first", () => {
    const app = readSource("src/App.tsx");

    expect(app.indexOf("<Stage")).toBeLessThan(app.indexOf("<ChannelTray"));
    expect(app.indexOf("<ChannelTray")).toBeLessThan(app.indexOf("<MasterPanel"));
  });

  test("offers Undo for removing a channel, deleting a session and clearing an unsaved one", () => {
    const app = readSource("src/App.tsx");

    expect(app).toMatch(/showToast\(`Removed “\$\{removed\.video\.title\}”\.`, \(\) =>/);
    expect(app).toMatch(/showToast\(`Deleted “\$\{sessionDisplayName\(mix\)\}”\.`, \(\) =>/);
    expect(app).toContain('showToast("Started a new session. The unsaved one was cleared.", () =>');
  });

  test("shows no old logo art", () => {
    expect(existsSync(join(repoRoot, "src/logo.svg"))).toBe(false);
    expect(readSource("src/index.html")).not.toContain("logo.svg");
  });
});
