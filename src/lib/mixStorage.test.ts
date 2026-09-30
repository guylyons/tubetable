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

  test("fills in a channel duration from its duration text for mixes saved before durations were stored", () => {
    const channel = rawChannel("a");
    const mix = sanitizePersistedMix({ channels: [{ ...channel, video: { ...channel.video, durationText: "3:21" } }] });

    expect(mix?.channels[0]?.durationSeconds).toBe(201);
    expect(
      sanitizePersistedMix({ channels: [rawChannel("b", { durationSeconds: 90 })] })?.channels[0]?.durationSeconds,
    ).toBe(90);
  });

  test("drops the old transport flag", () => {
    const mix = sanitizePersistedMix({ channels: [rawChannel("a")], transportPlaying: true });

    expect(mix && "transportPlaying" in mix).toBe(false);
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
    expect(state.draft).toEqual(createEmptyMix());
  });

  test("returns the example mix when nothing is stored", () => {
    withStoredValue(null);
    expect(readStoredMixState().currentMixKey).toBe("example-mix");
  });

  test("returns the example mix when storage holds invalid JSON", () => {
    withStoredValue("{not json");
    expect(readStoredMixState().currentMixKey).toBe("example-mix");
  });

  test("dates the example mix to when it was first created, not a fixed day that shifts by time zone", () => {
    const before = Date.now();
    const [example] = readStoredMixState().savedMixes;

    expect(Date.parse(example!.updatedAt)).toBeGreaterThanOrEqual(before);
  });

  test("loads the current storage shape, newest saved mix first", () => {
    withStoredValue(
      JSON.stringify({
        currentMixKey: "saved-1",
        draft: { name: "Working", channels: [rawChannel("a")], masterVolume: 80 },
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
    expect(state.savedMixes.map(mix => mix.id)).toEqual(["saved-2", "saved-1"]);
  });

  test("does not bring back the example mix after it was deleted", () => {
    withStoredValue(JSON.stringify({ currentMixKey: DRAFT_MIX_KEY, draft: { channels: [] }, savedMixes: [] }));

    expect(readStoredMixState().savedMixes).toEqual([]);
  });

  test("falls back to the draft when the current saved mix is gone", () => {
    withStoredValue(JSON.stringify({ currentMixKey: "gone", draft: { channels: [] }, savedMixes: [] }));

    expect(readStoredMixState().currentMixKey).toBe(DRAFT_MIX_KEY);
  });

  test("keeps unsaved edits from the old draft cache by applying them to their saved mixes", () => {
    withStoredValue(
      JSON.stringify({
        currentMixKey: "saved-1",
        draft: { name: "Active edits", channels: [rawChannel("a")], masterVolume: 60 },
        draftCache: {
          [DRAFT_MIX_KEY]: { name: "Scratch", channels: [rawChannel("b")] },
          "saved-2": { name: "Cached edits", channels: [], masterVolume: 20 },
        },
        savedMixes: [
          { id: "saved-1", updatedAt: "2026-01-01T00:00:00.000Z", name: "One", channels: [] },
          { id: "saved-2", updatedAt: "2026-03-01T00:00:00.000Z", name: "Two", channels: [] },
        ],
      }),
    );
    const state = readStoredMixState();

    expect(state.currentMixKey).toBe("saved-1");
    expect(state.draft.name).toBe("Scratch");
    expect(state.savedMixes.find(mix => mix.id === "saved-1")).toMatchObject({
      name: "Active edits",
      masterVolume: 60,
    });
    expect(state.savedMixes.find(mix => mix.id === "saved-2")).toMatchObject({
      name: "Cached edits",
      masterVolume: 20,
    });
  });

  test("loads the legacy single-mix shape as the draft", () => {
    withStoredValue(JSON.stringify({ name: "Legacy", channels: [rawChannel("a")] }));
    const state = readStoredMixState();

    expect(state.currentMixKey).toBe(DRAFT_MIX_KEY);
    expect(state.draft.name).toBe("Legacy");
    expect(state.savedMixes).toEqual([]);
  });

  test("loads every channel paused, because browsers block sound until the user presses play", () => {
    withStoredValue(
      JSON.stringify({
        currentMixKey: DRAFT_MIX_KEY,
        draft: { channels: [rawChannel("a")] },
        savedMixes: [{ id: "s1", updatedAt: "2026-01-01T00:00:00.000Z", channels: [rawChannel("b")] }],
      }),
    );
    const state = readStoredMixState();

    expect(state.draft.channels[0]?.paused).toBe(true);
    expect(state.savedMixes[0]?.channels[0]?.paused).toBe(true);
  });
});
