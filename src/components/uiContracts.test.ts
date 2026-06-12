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

    expect(source).toContain("isFocused ? \"pointer-events-auto opacity-100\" : \"pointer-events-none opacity-0\"");
  });

  test("scrolls the Library list after roughly six saved mixes", () => {
    const source = readSource("src/components/SavedMixesPanel.tsx");

    expect(source).toContain("max-h-[36rem]");
    expect(source).toContain("overflow-y-auto");
    expect(source).toContain("pr-2");
  });

  test("uses a pointer cursor for the light/dark mode toggle", () => {
    const source = readSource("src/components/MixHeader.tsx");

    expect(source).toContain("cursor-pointer");
  });
});
