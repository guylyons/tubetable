import { describe, expect, test } from "bun:test";
import { DRAFT_MIX_KEY, type MixChannel, type MixLibrary, type SavedMix } from "../types";
import { createEmptyMix } from "./mixStorage";
import { deleteMix, duplicateMix, getCurrentMix, restoreMix, saveDraft, selectMix, updateMix } from "./mixLibrary";

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

function savedMix(id: string, overrides: Partial<SavedMix> = {}): SavedMix {
  return { ...createEmptyMix(id), id, updatedAt: "2026-01-01T00:00:00.000Z", ...overrides };
}

function library(overrides: Partial<MixLibrary> = {}): MixLibrary {
  return { currentMixKey: DRAFT_MIX_KEY, draft: createEmptyMix(), savedMixes: [], ...overrides };
}

describe("getCurrentMix", () => {
  test("returns the draft when the draft is current", () => {
    const draft = { ...createEmptyMix("Draft"), channels: [channel("a")] };

    expect(getCurrentMix(library({ draft }))).toBe(draft);
  });

  test("returns the saved mix when a saved mix is current", () => {
    const mix = savedMix("s1");

    expect(getCurrentMix(library({ currentMixKey: "s1", savedMixes: [mix] }))).toBe(mix);
  });
});

describe("updateMix", () => {
  test("writes edits straight into a saved mix so it saves automatically", () => {
    const state = library({ currentMixKey: "s1", savedMixes: [savedMix("s1"), savedMix("s2")] });
    const next = updateMix(state, "s1", mix => ({ ...mix, masterVolume: 40 }), "2026-02-02T00:00:00.000Z");

    expect(next.savedMixes[0]).toMatchObject({ id: "s1", masterVolume: 40, updatedAt: "2026-02-02T00:00:00.000Z" });
    expect(next.savedMixes[1]).toBe(state.savedMixes[1]!);
  });

  test("keeps updatedAt when no timestamp is given, so playback progress does not count as an edit", () => {
    const state = library({ savedMixes: [savedMix("s1", { channels: [channel("a")] })] });
    const next = updateMix(state, "s1", mix => ({ ...mix, channels: [{ ...mix.channels[0]!, progressSeconds: 9 }] }));

    expect(next.savedMixes[0]?.channels[0]?.progressSeconds).toBe(9);
    expect(next.savedMixes[0]?.updatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  test("updates the draft by its key", () => {
    const next = updateMix(library(), DRAFT_MIX_KEY, mix => ({ ...mix, name: "Renamed" }));

    expect(next.draft.name).toBe("Renamed");
  });

  test("ignores a key that no longer exists", () => {
    const state = library();

    expect(updateMix(state, "gone", mix => ({ ...mix, name: "x" }))).toBe(state);
  });
});

describe("saveDraft", () => {
  test("moves the draft to the top of the library, selects it and clears the draft", () => {
    const draft = { ...createEmptyMix(), channels: [channel("a")] };
    const next = saveDraft(library({ draft, savedMixes: [savedMix("old")] }), {
      id: "new",
      name: "Rain Room",
      updatedAt: "2026-03-03T00:00:00.000Z",
    });

    expect(next.currentMixKey).toBe("new");
    expect(next.savedMixes.map(mix => mix.id)).toEqual(["new", "old"]);
    expect(next.savedMixes[0]).toMatchObject({ name: "Rain Room", channels: draft.channels });
    expect(next.draft).toEqual(createEmptyMix());
  });
});

describe("selectMix", () => {
  test("keeps the music going when switching away from a playing session", () => {
    const state = library({
      savedMixes: [savedMix("s1", { channels: [channel("a", { paused: true }), channel("b")] })],
    });
    const next = selectMix(state, "s1", true);

    expect(next.currentMixKey).toBe("s1");
    expect(next.savedMixes[0]?.channels.map(item => item.paused)).toEqual([false, false]);
  });

  test("loads a session paused when nothing was playing", () => {
    const state = library({ savedMixes: [savedMix("s1", { channels: [channel("a")] })] });

    expect(selectMix(state, "s1", false).savedMixes[0]?.channels[0]?.paused).toBe(true);
  });
});

describe("duplicateMix", () => {
  test("adds a copy right after the original without switching to it", () => {
    const state = library({
      currentMixKey: "s1",
      savedMixes: [savedMix("s1", { name: "Rain", channels: [channel("a")] }), savedMix("s2")],
    });
    const next = duplicateMix(state, "s1", { id: "copy", updatedAt: "2026-04-04T00:00:00.000Z" });

    expect(next.currentMixKey).toBe("s1");
    expect(next.savedMixes.map(mix => mix.id)).toEqual(["s1", "copy", "s2"]);
    expect(next.savedMixes[1]).toMatchObject({ name: "Rain copy", channels: state.savedMixes[0]!.channels });
  });

  test("ignores an unknown session", () => {
    const state = library();

    expect(duplicateMix(state, "gone", { id: "copy", updatedAt: "" })).toBe(state);
  });
});

describe("deleteMix and restoreMix", () => {
  test("deleting the current mix keeps its tracks on the table as the draft", () => {
    const mix = savedMix("s1", { channels: [channel("a")] });
    const next = deleteMix(library({ currentMixKey: "s1", savedMixes: [mix] }), "s1");

    expect(next.savedMixes).toEqual([]);
    expect(next.currentMixKey).toBe(DRAFT_MIX_KEY);
    expect(next.draft.channels).toEqual(mix.channels);
  });

  test("deleting another mix leaves the current one alone", () => {
    const state = library({ currentMixKey: "s1", savedMixes: [savedMix("s1"), savedMix("s2")] });
    const next = deleteMix(state, "s2");

    expect(next.currentMixKey).toBe("s1");
    expect(next.savedMixes.map(mix => mix.id)).toEqual(["s1"]);
  });

  test("undo puts a deleted mix back where it was", () => {
    const state = library({ savedMixes: [savedMix("s1"), savedMix("s2"), savedMix("s3")] });
    const deleted = state.savedMixes[1]!;
    const next = restoreMix(deleteMix(state, "s2"), { mix: deleted, index: 1, wasCurrent: false });

    expect(next.savedMixes.map(mix => mix.id)).toEqual(["s1", "s2", "s3"]);
  });

  test("undoing the delete of the current mix selects it again with any edits made since", () => {
    const mix = savedMix("s1", { channels: [channel("a")] });
    const afterDelete = deleteMix(library({ currentMixKey: "s1", savedMixes: [mix] }), "s1");
    const edited = updateMix(afterDelete, DRAFT_MIX_KEY, draft => ({ ...draft, masterVolume: 30 }));
    const next = restoreMix(edited, { mix, index: 0, wasCurrent: true });

    expect(next.currentMixKey).toBe("s1");
    expect(next.savedMixes[0]).toMatchObject({ id: "s1", masterVolume: 30 });
    expect(next.draft).toEqual(createEmptyMix());
  });
});
