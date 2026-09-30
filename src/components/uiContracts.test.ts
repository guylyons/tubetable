import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..", "..");

function readSource(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

describe("UI interaction contracts", () => {
  test("keeps the focused video's Focus control clickable and visible so users can exit focus mode", () => {
    const source = readSource("src/components/VideoTile.tsx");

    expect(source).toContain('isFocused ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"');
  });

  test("always shows the Remove and Focus controls on touch screens, which have no hover", () => {
    const source = readSource("src/components/VideoTile.tsx");
    const touchVisible = "[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100";

    expect(source.split(touchVisible).length - 1).toBe(2);
  });

  test("positions the Focus control above the scrubber hit target", () => {
    const source = readSource("src/components/VideoTile.tsx");

    expect(source).toContain("absolute top-3 right-16");
    expect(source).not.toContain("absolute bottom-3 right-3 z-20 inline-flex cursor-pointer");
  });

  test("scrolls the Library list after roughly six saved mixes", () => {
    const source = readSource("src/components/SavedMixesPanel.tsx");

    expect(source).toContain("max-h-[36rem]");
    expect(source).toContain("overflow-y-auto");
    expect(source).toContain("pr-2");
  });

  test("uses a single-line search input so Enter submits the add form", () => {
    const source = readSource("src/components/SearchPanel.tsx");

    expect(source).not.toContain("<textarea");
    expect(source).toContain('type="search"');
    expect(source).toContain('enterKeyHint="go"');
  });

  test("uses a pointer cursor for the light/dark mode toggle", () => {
    const source = readSource("src/components/MixHeader.tsx");

    expect(source).toContain("cursor-pointer");
  });

  test("does not reopen search results when a search finishes after the input lost focus", () => {
    const source = readSource("src/App.tsx");

    expect(source).not.toMatch(/setSearchSuggestions\(data\.suggestions\);\s*setShowResults\(true\)/);
  });

  test("keeps every logo letter on the baseline grid so the wordmark reads as one word", () => {
    const source = readSource("src/index.css");

    expect(source).not.toContain("tubetable-logo-letter-e");
  });
});
