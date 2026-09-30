import { describe, expect, test } from "bun:test";
import {
  createYouTubePlayerVars,
  formatPlaybackTime,
  getPlayerStatus,
  parseDurationText,
  seekPlayer,
  syncPlayerPlayback,
  type YouTubePlayer,
} from "./youtube";

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

describe("parseDurationText", () => {
  test("reads m:ss and h:mm:ss", () => {
    expect(parseDurationText("4:05")).toBe(245);
    expect(parseDurationText("1:02:15")).toBe(3735);
  });

  test("returns zero for missing or odd text", () => {
    expect(parseDurationText(undefined)).toBe(0);
    expect(parseDurationText("LIVE")).toBe(0);
  });
});

describe("getPlayerStatus", () => {
  test("maps YouTube player states to channel statuses", () => {
    expect(getPlayerStatus(-1)).toBe("paused");
    expect(getPlayerStatus(0)).toBe("ended");
    expect(getPlayerStatus(1)).toBe("playing");
    expect(getPlayerStatus(2)).toBe("paused");
    expect(getPlayerStatus(3)).toBe("buffering");
    expect(getPlayerStatus(5)).toBe("paused");
  });
});

describe("seekPlayer", () => {
  function createPlayer() {
    const calls: string[] = [];
    const player: YouTubePlayer = {
      destroy: () => calls.push("destroy"),
      mute: () => calls.push("mute"),
      pauseVideo: () => calls.push("pauseVideo"),
      playVideo: () => calls.push("playVideo"),
      seekTo: seconds => calls.push(`seekTo ${seconds}`),
      setVolume: () => calls.push("setVolume"),
      unMute: () => calls.push("unMute"),
    };

    return { calls, player };
  }

  test("keeps a paused channel paused, because seekTo starts a cued video", () => {
    const { calls, player } = createPlayer();

    seekPlayer(player, 42, false);

    expect(calls).toEqual(["seekTo 42", "pauseVideo"]);
  });

  test("just seeks a playing channel", () => {
    const { calls, player } = createPlayer();

    seekPlayer(player, 42, true);

    expect(calls).toEqual(["seekTo 42"]);
  });

  test("swallows errors from a player that is still starting up", () => {
    const { player } = createPlayer();

    expect(() =>
      seekPlayer(
        {
          ...player,
          seekTo: () => {
            throw new Error("not ready");
          },
        },
        1,
        true,
      ),
    ).not.toThrow();
  });
});
