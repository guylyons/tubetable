import { describe, expect, test } from "bun:test";
import {
  BAR_COUNT,
  buildVisualizerProfile,
  calculateVisualizerLevels,
  getStaticVisualizerState,
  shouldAnimateVisualizer,
} from "./transportVisualizer";
import type { MixChannelState } from "../types";

function channel(id: string, overrides: Partial<MixChannelState> = {}): MixChannelState {
  return {
    id,
    effectiveVolume: 76,
    looped: true,
    muted: false,
    paused: false,
    progressSeconds: 0,
    silencedBy: null,
    solo: false,
    video: {
      channelTitle: "Test channel",
      thumbnail: "https://example.com/thumb.jpg",
      title: `Video ${id}`,
      videoId: id,
    },
    volume: 76,
    ...overrides,
  };
}

describe("buildVisualizerProfile", () => {
  test("uses only audible playing channels", () => {
    const profile = buildVisualizerProfile(
      [
        channel("loud", { effectiveVolume: 90, progressSeconds: 12 }),
        channel("paused", { effectiveVolume: 90, paused: true }),
        channel("silent", { effectiveVolume: 0 }),
      ],
      true,
    );

    expect(profile.activeCount).toBe(1);
    expect(profile.averageLevel).toBeCloseTo(0.9, 5);
    expect(profile.peakLevel).toBeCloseTo(0.9, 5);
    expect(profile.tracks).toEqual([expect.objectContaining({ level: 0.9, progressSeconds: 12, slot: 0 })]);
  });

  test("has no active tracks while transport is paused", () => {
    const profile = buildVisualizerProfile([channel("ready")], false);

    expect(profile.activeCount).toBe(0);
    expect(profile.averageLevel).toBe(0);
    expect(profile.peakLevel).toBe(0);
    expect(profile.tracks).toEqual([]);
  });
});

describe("calculateVisualizerLevels", () => {
  test("returns a stable low floor when there is no audible track", () => {
    const profile = buildVisualizerProfile([channel("muted", { muted: true })], true);

    const levels = calculateVisualizerLevels({
      energy: 0,
      previousLevels: Array.from({ length: BAR_COUNT }, () => 0.9),
      profile,
      timestamp: 1_000,
    });

    expect(levels.energy).toBe(0);
    expect(levels.levels).toHaveLength(BAR_COUNT);
    expect(Math.max(...levels.levels)).toBeLessThanOrEqual(0.2);
    expect(Math.min(...levels.levels)).toBeGreaterThanOrEqual(0.05);
  });

  test("shapes audible channels into separate moving frequency bands", () => {
    const profile = buildVisualizerProfile(
      [
        channel("low", { effectiveVolume: 35, progressSeconds: 3 }),
        channel("high", { effectiveVolume: 95, progressSeconds: 14 }),
      ],
      true,
    );

    const first = calculateVisualizerLevels({
      energy: 0,
      previousLevels: Array.from({ length: BAR_COUNT }, () => 0.12),
      profile,
      timestamp: 1_000,
    });
    const second = calculateVisualizerLevels({
      energy: first.energy,
      previousLevels: first.levels,
      profile,
      timestamp: 1_120,
    });

    expect(second.levels).toHaveLength(BAR_COUNT);
    expect(Math.max(...second.levels)).toBeGreaterThan(0.45);
    expect(second.levels.some((level, index) => Math.abs(level - first.levels[index]!) > 0.02)).toBe(true);
    expect(second.bandActivity.low + second.bandActivity.mid + second.bandActivity.high).toBeGreaterThan(0);
    expect(second.bandActivity.high).toBeGreaterThan(second.bandActivity.low);
  });
});

describe("shouldAnimateVisualizer", () => {
  const playing = buildVisualizerProfile([channel("a")], true);

  test("animates only while something audible is playing", () => {
    expect(shouldAnimateVisualizer(playing, false)).toBe(true);
    expect(shouldAnimateVisualizer(buildVisualizerProfile([channel("a")], false), false)).toBe(false);
    expect(shouldAnimateVisualizer(buildVisualizerProfile([], true), false)).toBe(false);
  });

  test("never animates when reduced motion is preferred", () => {
    expect(shouldAnimateVisualizer(playing, true)).toBe(false);
  });
});

describe("getStaticVisualizerState", () => {
  test("shows flat idle bars when nothing is playing", () => {
    const state = getStaticVisualizerState(buildVisualizerProfile([], true));

    expect(state.energy).toBe(0);
    expect(state.levels).toEqual(Array.from({ length: BAR_COUNT }, () => 0.08));
    expect(state.bandActivity).toEqual({ low: 0, mid: 0, high: 0 });
  });

  test("shows a fixed snapshot of playing channels that does not change with playback progress", () => {
    const early = getStaticVisualizerState(
      buildVisualizerProfile([channel("a", { progressSeconds: 1 }), channel("b", { effectiveVolume: 95 })], true),
    );
    const later = getStaticVisualizerState(
      buildVisualizerProfile([channel("a", { progressSeconds: 40 }), channel("b", { effectiveVolume: 95 })], true),
    );

    expect(later).toEqual(early);
    expect(early.levels).toHaveLength(BAR_COUNT);
    expect(Math.max(...early.levels)).toBeGreaterThan(0.3);
    expect(early.bandActivity.high).toBeGreaterThan(0);
  });
});
