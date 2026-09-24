import { describe, expect, test } from "bun:test";
import type { MixChannel } from "../types";
import { buildChannelStates, getStripStatus } from "./mixChannels";

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
    ...overrides,
  };
}

describe("getStripStatus", () => {
  test("shows the level after master for an audible channel", () => {
    const [state] = buildChannelStates([channel("a")], 50);

    expect(getStripStatus(state!)).toEqual({ silencedBy: null, levelLabel: "38%" });
  });

  test("marks a muted channel as silenced by mute", () => {
    const [state] = buildChannelStates([channel("a", { muted: true })], 100);

    expect(getStripStatus(state!)).toEqual({ silencedBy: "mute", levelLabel: "Muted" });
  });

  test("marks a channel as silenced by solo when another channel is soloed", () => {
    const states = buildChannelStates([channel("a"), channel("b", { solo: true })], 100);

    expect(getStripStatus(states[0]!)).toEqual({ silencedBy: "solo", levelLabel: "Off (solo)" });
    expect(getStripStatus(states[1]!)).toEqual({ silencedBy: null, levelLabel: "76%" });
  });

  test("mute wins over solo on the same channel", () => {
    const [state] = buildChannelStates([channel("a", { muted: true, solo: true })], 100);

    expect(getStripStatus(state!).silencedBy).toBe("mute");
  });
});
