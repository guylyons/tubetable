import { afterEach, describe, expect, test } from "bun:test";
import { DRAFT_MIX_KEY, MAX_CHANNELS, STORAGE_KEY } from "../types";
import { createEmptyMix, readStoredMixState, sanitizePersistedMix } from "./mixStorage";

function rawChannel(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    video: {
      videoId: `video-${id}`,
      title: `Title ${id}`,
      channelTitle: "Channel",
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    },
    volume: 50,
    muted: false,
    solo: false,
    paused: false,
    looped: false,
    progressSeconds: 12,
    ...overrides,
  };
}

function withStoredValue(value: string | null) {
  (globalThis as { window?: unknown }).window = {
    localStorage: { getItem: (key: string) => (key === STORAGE_KEY ? value : null) },
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("sanitizePersistedMix", () => {
  test("rejects values without a channels array", () => {
    expect(sanitizePersistedMix(null)).toBeNull();
    expect(sanitizePersistedMix("mix")).toBeNull();
    expect(sanitizePersistedMix({ name: "No channels" })).toBeNull();
  });

  test("defaults missing top-level fields", () => {
    expect(sanitizePersistedMix({ channels: [] })).toEqual(createEmptyMix());
  });

  test("defaults channel fields added after the first release", () => {
    const { looped, progressSeconds, ...oldChannel } = rawChannel("a");
    const mix = sanitizePersistedMix({ channels: [oldChannel] });

    expect(mix?.channels[0]?.looped).toBe(true);
    expect(mix?.channels[0]?.progressSeconds).toBe(0);
  });

  test("clamps negative progress to zero", () => {
    const mix = sanitizePersistedMix({ channels: [rawChannel("a", { progressSeconds: -5 })] });
    expect(mix?.channels[0]?.progressSeconds).toBe(0);
  });

  test("drops malformed channels and keeps at most MAX_CHANNELS", () => {
    const channels = [
      rawChannel("bad", { volume: "loud" }),
      { id: "no-video", volume: 1, muted: false, solo: false, paused: false },
      ...Array.from({ length: MAX_CHANNELS + 2 }, (_, index) => rawChannel(`c${index}`)),
    ];
    const mix = sanitizePersistedMix({ channels });

    expect(mix?.channels.map(channel => channel.id)).toEqual(["c0", "c1", "c2", "c3", "c4"]);
  });

  test("clears a focused channel that no longer exists", () => {
    const channels = [rawChannel("a")];

    expect(sanitizePersistedMix({ channels, focusedChannelId: "a" })?.focusedChannelId).toBe("a");
    expect(sanitizePersistedMix({ channels, focusedChannelId: "gone" })?.focusedChannelId).toBeNull();
  });

  test("keeps optional video text only when it is a string", () => {
    const channel = rawChannel("a");
    const video = { ...channel.video, durationText: "3:21", viewCountText: 42 };
    const mix = sanitizePersistedMix({ channels: [{ ...channel, video }] });

    expect(mix?.channels[0]?.video.durationText).toBe("3:21");
    expect(mix?.channels[0]?.video.viewCountText).toBeUndefined();
  });
});

describe("readStoredMixState", () => {
  test("returns the example mix when window is unavailable", () => {
    const state = readStoredMixState();

    expect(state.currentMixKey).toBe("example-mix");
    expect(state.savedMixes.map(mix => mix.id)).toEqual(["example-mix"]);
    expect(state.draftCache[DRAFT_MIX_KEY]).toEqual(createEmptyMix());
  });

  test("returns the example mix when nothing is stored", () => {
    withStoredValue(null);
    expect(readStoredMixState().currentMixKey).toBe("example-mix");
  });

  test("returns the example mix when storage holds invalid JSON", () => {
    withStoredValue("{not json");
    expect(readStoredMixState().currentMixKey).toBe("example-mix");
  });

  test("loads the current storage shape", () => {
    withStoredValue(
      JSON.stringify({
        currentMixKey: "saved-1",
        draft: { name: "Working", channels: [rawChannel("a")], masterVolume: 80 },
        draftCache: { other: { name: "Other", channels: [] }, broken: { name: "No channels" } },
        savedMixes: [
          { id: "saved-1", updatedAt: "2026-01-01T00:00:00.000Z", name: "Older", channels: [] },
          { id: "saved-2", updatedAt: "2026-03-01T00:00:00.000Z", name: "Newer", channels: [] },
          { id: "saved-3", name: "No channels" },
        ],
      }),
    );
    const state = readStoredMixState();

    expect(state.currentMixKey).toBe("saved-1");
    expect(state.draft.name).toBe("Working");
    expect(state.draft.masterVolume).toBe(80);
    expect(state.draftCache["saved-1"]).toEqual(state.draft);
    expect(state.draftCache.other?.name).toBe("Other");
    expect(state.draftCache.broken).toBeUndefined();
    expect(state.draftCache[DRAFT_MIX_KEY]).toEqual(createEmptyMix());
    expect(state.savedMixes.map(mix => mix.id)).toEqual(["example-mix", "saved-2", "saved-1"]);
  });

  test("does not duplicate the example mix when it was saved", () => {
    withStoredValue(
      JSON.stringify({
        draft: { channels: [] },
        savedMixes: [{ id: "example-mix", updatedAt: "2026-01-01T00:00:00.000Z", name: "Mine", channels: [] }],
      }),
    );
    const state = readStoredMixState();

    expect(state.currentMixKey).toBe(DRAFT_MIX_KEY);
    expect(state.savedMixes.map(mix => mix.name)).toEqual(["Mine"]);
  });

  test("loads the legacy single-mix shape as the draft", () => {
    withStoredValue(JSON.stringify({ name: "Legacy", channels: [rawChannel("a")] }));
    const state = readStoredMixState();

    expect(state.currentMixKey).toBe(DRAFT_MIX_KEY);
    expect(state.draft.name).toBe("Legacy");
    expect(state.draftCache[DRAFT_MIX_KEY]).toEqual(state.draft);
    expect(state.savedMixes.map(mix => mix.id)).toEqual(["example-mix"]);
  });
});
