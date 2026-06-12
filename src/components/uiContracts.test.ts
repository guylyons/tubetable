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

  test("uses a pointer cursor for the light/dark mode toggle", () => {
    const source = readSource("src/components/MixHeader.tsx");

    expect(source).toContain("cursor-pointer");
  });

  test("restores DSP effects in a track options modal without the unfinished loop editor", () => {
    const videoTileSource = readSource("src/components/VideoTile.tsx");
    const typesSource = readSource("src/types.ts");
    const trackAudioSource = readSource("src/lib/trackAudio.ts");
    const serverSource = readSource("src/server.ts");

    expect(videoTileSource).toContain("Track options");
    expect(videoTileSource).toContain("DSP effects");
    expect(videoTileSource).toContain("Reverb");
    expect(videoTileSource).toContain("Delay");
    expect(videoTileSource).toContain("Lofi");
    expect(videoTileSource).toContain("Pitch");
    expect(videoTileSource).not.toContain("LoopRegionEditor");
    expect(videoTileSource).not.toContain("Beat sync");
    expect(typesSource).toContain("reverbEnabled: boolean");
    expect(typesSource).toContain("delayEnabled: boolean");
    expect(typesSource).toContain("lofiEnabled: boolean");
    expect(typesSource).toContain("pitchShiftEnabled: boolean");
    expect(trackAudioSource).toContain("class TrackAudioController");
    expect(trackAudioSource).toContain("setEffects(effects: TrackEffectState)");
    expect(serverSource).toContain('"/api/youtube/audio"');
  });

  test("keeps default no-DSP playback on the YouTube iframe so scrubbed playback resumes immediately", () => {
    const videoTileSource = readSource("src/components/VideoTile.tsx");

    expect(videoTileSource).toContain("const usesWebAudio =");
    expect(videoTileSource).toContain("if (!usesWebAudio)");
    expect(videoTileSource).toContain("usesWebAudio ? 0 : effectiveVolume");
    expect(videoTileSource).toContain("if (usesWebAudio) {\n        audioControllerRef.current?.seek(nextProgressSeconds);");
  });
});
