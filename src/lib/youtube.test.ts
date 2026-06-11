import { describe, expect, test } from "bun:test";
import {
  createYouTubePlayerVars,
  getSeekSecondsFromProgressValue,
  syncPlayerPlayback,
  type YouTubePlayer,
} from "./youtube";

describe("createYouTubePlayerVars", () => {
  test("keeps YouTube controls visible so embeds show their progress bar", () => {
    expect(createYouTubePlayerVars(12.8)).toMatchObject({
      controls: 1,
      start: 12,
    });
  });

  test("clamps negative start positions to zero", () => {
    expect(createYouTubePlayerVars(-3).start).toBe(0);
  });
});

describe("getSeekSecondsFromProgressValue", () => {
  test("converts a scrubber percentage into a clamped playback timestamp", () => {
    expect(getSeekSecondsFromProgressValue("25", 240)).toBe(60);
    expect(getSeekSecondsFromProgressValue("125", 240)).toBe(240);
    expect(getSeekSecondsFromProgressValue("-10", 240)).toBe(0);
  });

  test("falls back to the current timestamp when the scrub value or duration is invalid", () => {
    expect(getSeekSecondsFromProgressValue("nope", 240, 42)).toBe(42);
    expect(getSeekSecondsFromProgressValue("50", 0, 42)).toBe(42);
  });
});

describe("syncPlayerPlayback", () => {
  function createPlayer(state: number | undefined) {
    const calls: string[] = [];
    const player: YouTubePlayer = {
      destroy: () => calls.push("destroy"),
      getPlayerState: () => state as number,
      mute: () => calls.push("mute"),
      pauseVideo: () => calls.push("pauseVideo"),
      playVideo: () => calls.push("playVideo"),
      seekTo: () => calls.push("seekTo"),
      setVolume: () => calls.push("setVolume"),
      unMute: () => calls.push("unMute"),
    };

    return { calls, player };
  }

  test("does not issue duplicate play commands while already playing", () => {
    const { calls, player } = createPlayer(1);

    syncPlayerPlayback(player, true);

    expect(calls).toEqual([]);
  });

  test("pauses a playing player when playback should stop", () => {
    const { calls, player } = createPlayer(1);

    syncPlayerPlayback(player, false);

    expect(calls).toEqual(["pauseVideo"]);
  });
});
