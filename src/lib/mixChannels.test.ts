import { describe, expect, test } from "bun:test";
import type { MixChannel } from "../types";
import {
  buildChannelStates,
  createChannel,
  formatSessionSummary,
  getChannelColor,
  getChannelStatus,
  isChannelPlaying,
  moveChannel,
  setAllPaused,
} from "./mixChannels";

function channel(id: string, overrides: Partial<MixChannel> = {}): MixChannel {
  return {
    id,
    video: { videoId: id, title: id, channelTitle: "", thumbnail: "" },
    volume: 76,
    muted: false,
    solo: false,
    paused: false,
    looped: true,
    progressSeconds: 0,
    durationSeconds: 0,
    ...overrides,
  };
}

describe("createChannel", () => {
  test("reads the duration from search results so session lengths show before playback", () => {
    const created = createChannel({
      videoId: "a",
      title: "A",
      channelTitle: "",
      thumbnail: "",
      durationText: "1:02:15",
    });

    expect(created.durationSeconds).toBe(3735);
    expect(created.paused).toBe(false);
  });

  test("leaves the duration at zero when search gave none", () => {
    expect(createChannel({ videoId: "a", title: "A", channelTitle: "", thumbnail: "" }).durationSeconds).toBe(0);
  });
});

describe("moveChannel", () => {
  const channels = [channel("a"), channel("b"), channel("c")];

  test("moves a channel one place left or right", () => {
    expect(moveChannel(channels, "b", -1).map(item => item.id)).toEqual(["b", "a", "c"]);
    expect(moveChannel(channels, "b", 1).map(item => item.id)).toEqual(["a", "c", "b"]);
  });

  test("leaves the order alone at either end", () => {
    expect(moveChannel(channels, "a", -1)).toBe(channels);
    expect(moveChannel(channels, "c", 1)).toBe(channels);
  });
});

describe("setAllPaused", () => {
  test("pauses or plays every channel", () => {
    const channels = [channel("a"), channel("b", { paused: true })];

    expect(setAllPaused(channels, true).map(item => item.paused)).toEqual([true, true]);
    expect(setAllPaused(channels, false).map(item => item.paused)).toEqual([false, false]);
  });
});

describe("getChannelColor", () => {
  test("gives each of the five channels its own color", () => {
    const colors = [0, 1, 2, 3, 4].map(getChannelColor);

    expect(new Set(colors).size).toBe(5);
    expect(getChannelColor(5)).toBe(colors[0]!);
  });
});

describe("getChannelStatus", () => {
  test("reports what the player is actually doing", () => {
    const [state] = buildChannelStates([channel("a")], 100);

    expect(getChannelStatus("loading", state!)).toEqual({ label: "Loading", tone: "busy" });
    expect(getChannelStatus("buffering", state!)).toEqual({ label: "Buffering", tone: "busy" });
    expect(getChannelStatus("playing", state!)).toEqual({ label: "Playing", tone: "live" });
    expect(getChannelStatus("paused", state!)).toEqual({ label: "Paused", tone: "idle" });
    expect(getChannelStatus("error", state!)).toEqual({ label: "Unavailable", tone: "error" });
    expect(getChannelStatus(undefined, state!)).toEqual({ label: "Loading", tone: "busy" });
  });

  test("says when a playing channel cannot be heard", () => {
    const states = buildChannelStates([channel("a", { muted: true }), channel("b"), channel("c", { solo: true })], 100);

    expect(getChannelStatus("playing", states[0]!).label).toBe("Muted");
    expect(getChannelStatus("playing", states[1]!).label).toBe("Off (solo)");
  });

  test("says a finished video that does not loop has ended", () => {
    const [state] = buildChannelStates([channel("a", { looped: false })], 100);

    expect(getChannelStatus("ended", state!)).toEqual({ label: "Ended", tone: "idle" });
  });
});

describe("isChannelPlaying", () => {
  test("counts buffering as playing so the button does not flicker", () => {
    expect(isChannelPlaying("playing")).toBe(true);
    expect(isChannelPlaying("buffering")).toBe(true);
    expect(isChannelPlaying("paused")).toBe(false);
    expect(isChannelPlaying(undefined)).toBe(false);
  });
});

describe("formatSessionSummary", () => {
  test("counts tracks and shows the longest one as the session length", () => {
    expect(formatSessionSummary([channel("a", { durationSeconds: 60 }), channel("b", { durationSeconds: 3735 })])).toBe(
      "2 tracks • 1:02:15",
    );
  });

  test("uses the singular and skips unknown lengths", () => {
    expect(formatSessionSummary([channel("a")])).toBe("1 track");
    expect(formatSessionSummary([])).toBe("No tracks");
  });
});
