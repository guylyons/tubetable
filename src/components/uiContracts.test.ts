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
    expect(typesSource).toContain("lofiHighpassHz: number");
    expect(typesSource).toContain("pitchShiftEnabled: boolean");
    expect(trackAudioSource).toContain("class TrackAudioController");
    expect(trackAudioSource).toContain("setEffects(effects: TrackEffectState)");
    expect(serverSource).toContain('"/api/youtube/audio"');
  });

  test("keeps default no-DSP playback on the YouTube iframe so scrubbed playback resumes immediately", () => {
    const videoTileSource = readSource("src/components/VideoTile.tsx");

    expect(videoTileSource).toContain("const usesWebAudio =");
    expect(videoTileSource).toContain("const webAudioActive = usesWebAudio && webAudioReady");
    expect(videoTileSource).toContain("webAudioActive ? 0 : effectiveVolume");
    expect(videoTileSource).toContain("if (webAudioActive) {\n        audioControllerRef.current?.seek(nextProgressSeconds);");
  });

  test("preloads DSP audio and waits until it is ready before muting the YouTube iframe", () => {
    const videoTileSource = readSource("src/components/VideoTile.tsx");
    const trackAudioSource = readSource("src/lib/trackAudio.ts");

    expect(trackAudioSource).toContain("onReady: () => void");
    expect(trackAudioSource).toContain("notifyReady");
    expect(videoTileSource).toContain("const [webAudioReady, setWebAudioReady] = useState(false)");
    expect(videoTileSource).toContain("onReady: () => {\n        if (!disposed) {\n          setWebAudioReady(true);");
    expect(videoTileSource).toContain("setWebAudioReady(false)");
    expect(videoTileSource).toContain("const webAudioActive = usesWebAudio && webAudioReady");
  });

  test("only creates the DSP audio controller while an effect is enabled", () => {
    const videoTileSource = readSource("src/components/VideoTile.tsx");

    expect(videoTileSource).toContain("primeSharedAudioContext");
    expect(videoTileSource).toContain("void primeSharedAudioContext();");
    expect(videoTileSource).toContain("if (!usesWebAudio) {\n      audioControllerRef.current?.destroy();");
    expect(videoTileSource).toContain("const player = playerRef.current;\n      if (player) {\n        applyPlayerVolume(player, effectiveVolume);");
    expect(videoTileSource).toContain("const controller = new TrackAudioController");
    expect(videoTileSource).toContain("const playbackState = playbackStateRef.current;\n    if (playbackState.transportPlaying && !playbackState.paused) {\n      void controller.play();");
  });

  test("seeks DSP audio by rebuilding the proxy stream at the requested offset", () => {
    const trackAudioSource = readSource("src/lib/trackAudio.ts");
    const audioProxySource = readSource("src/lib/youtubeAudioProxy.ts");

    expect(trackAudioSource).toContain("startSeconds");
    expect(trackAudioSource).toContain("mediaStartSeconds");
    expect(trackAudioSource).toContain("this.loadAt(nextSeconds");
    expect(audioProxySource).toContain("parseStartSeconds");
    expect(audioProxySource).toContain('"-ss"');
  });

  test("polishes DSP tone controls and keeps DSP audio synced to the video clock", () => {
    const videoTileSource = readSource("src/components/VideoTile.tsx");
    const trackAudioSource = readSource("src/lib/trackAudio.ts");
    const trackDspSource = readSource("src/lib/trackDsp.ts");
    const mixChannelsSource = readSource("src/lib/mixChannels.ts");

    expect(trackDspSource).toContain("lofiHighpassFilter");
    expect(trackDspSource).toContain('lofiHighpassFilter.type = "highpass"');
    expect(videoTileSource).toContain("High-pass");
    expect(trackDspSource).toContain("reverbToneFilter");
    expect(trackDspSource).toContain("reverbWetGain.gain.value = effects.reverbEnabled ? clamp(effects.reverbMix, 22, 0, 35) / 100 : 0");
    expect(trackAudioSource).toContain("syncTo(referenceSeconds: number");
    expect(videoTileSource).toContain("audioControllerRef.current?.syncTo(playerTime)");
    expect(mixChannelsSource).toContain("silencedBySolo");
    expect(videoTileSource).toContain("channel.silencedBySolo");
  });

  test("guards DSP AudioParam values against missing persisted effect fields", () => {
    const trackDspSource = readSource("src/lib/trackDsp.ts");

    expect(trackDspSource).toContain("function clamp(value: unknown, fallback: number, min: number, max: number)");
    expect(trackDspSource).toContain("const lofiMix = effects.lofiEnabled ? clamp(effects.lofiMix, 40, 0, 100) / 100 : 0");
    expect(trackDspSource).toContain("clamp(effects.lofiHighpassHz, 80, 20, 1200)");
    expect(trackDspSource).toContain("clamp(effects.lofiCutoffHz, 2400, 300, 12000)");
  });

  test("keeps DSP diagnostics behind an explicit debug switch", () => {
    const trackAudioSource = readSource("src/lib/trackAudio.ts");
    const diagnosticsSource = readSource("src/lib/audioDiagnostics.ts");

    expect(trackAudioSource).toContain("createAudioDiagnostics");
    expect(trackAudioSource).toContain("isAudioDiagnosticsEnabled()");
    expect(trackAudioSource).toContain('this.diagnostics.record("media-event"');
    expect(trackAudioSource).toContain('this.diagnostics.record("set-effects"');
    expect(trackAudioSource).toContain('this.diagnostics.record("sync-reload"');
    expect(diagnosticsSource).toContain("localStorage.getItem(AUDIO_DIAGNOSTICS_STORAGE_KEY)");
    expect(diagnosticsSource).toContain('url.searchParams.get("debugAudio") === "1"');
  });
});
