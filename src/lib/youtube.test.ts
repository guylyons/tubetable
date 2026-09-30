import { describe, expect, test } from "bun:test";
import { createYouTubePlayerVars, formatPlaybackTime, syncPlayerPlayback, type YouTubePlayer } from "./youtube";

describe("createYouTubePlayerVars", () => {
  test("hides YouTube's own controls because the tile draws its own scrubber", () => {
    expect(createYouTubePlayerVars(12.8)).toMatchObject({
      controls: 0,
      start: 12,
    });
  });

  test("clamps negative start positions to zero", () => {
    expect(createYouTubePlayerVars(-3).start).toBe(0);
  });
});

describe("formatPlaybackTime", () => {
  test("formats minutes and seconds", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(65.9)).toBe("1:05");
  });

  test("adds hours for long videos", () => {
    expect(formatPlaybackTime(4 * 3600 + 57 * 60 + 41)).toBe("4:57:41");
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
