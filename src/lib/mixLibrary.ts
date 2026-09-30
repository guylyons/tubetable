import { DRAFT_MIX_KEY, type DeletedMix, type MixLibrary, type PersistedMix, type SavedMix } from "../types";
import { setAllPaused } from "./mixChannels";
import { createEmptyMix } from "./mixStorage";

function toPersistedMix({ name, channels, masterVolume, focusedChannelId }: PersistedMix): PersistedMix {
  return { name, channels, masterVolume, focusedChannelId };
}

export function getCurrentMix(library: MixLibrary): PersistedMix {
  return library.savedMixes.find(mix => mix.id === library.currentMixKey) ?? library.draft;
}

// Saved mixes update in place, so there is nothing separate to save. Pass `updatedAt`
// for user edits and leave it out for playback progress.
export function updateMix(
  library: MixLibrary,
  mixKey: string,
  updater: (mix: PersistedMix) => PersistedMix,
  updatedAt?: string,
): MixLibrary {
  if (mixKey === DRAFT_MIX_KEY) {
    return { ...library, draft: updater(library.draft) };
  }

  if (!library.savedMixes.some(mix => mix.id === mixKey)) {
    return library;
  }

  return {
    ...library,
    savedMixes: library.savedMixes.map(mix =>
      mix.id === mixKey ? { ...mix, ...updater(mix), updatedAt: updatedAt ?? mix.updatedAt } : mix,
    ),
  };
}

export function saveDraft(library: MixLibrary, { id, name, updatedAt }: Pick<SavedMix, "id" | "name" | "updatedAt">) {
  const savedMix: SavedMix = { ...toPersistedMix(library.draft), name, id, updatedAt };

  return {
    currentMixKey: id,
    draft: createEmptyMix(),
    savedMixes: [savedMix, ...library.savedMixes],
  } satisfies MixLibrary;
}

// Switching sessions carries the transport over: if music was playing, the new session starts playing.
export function selectMix(library: MixLibrary, mixKey: string, keepPlaying: boolean): MixLibrary {
  return updateMix({ ...library, currentMixKey: mixKey }, mixKey, mix => ({
    ...mix,
    channels: setAllPaused(mix.channels, !keepPlaying),
  }));
}

export function duplicateMix(
  library: MixLibrary,
  mixKey: string,
  { id, updatedAt }: Pick<SavedMix, "id" | "updatedAt">,
): MixLibrary {
  const index = library.savedMixes.findIndex(mix => mix.id === mixKey);
  const source = library.savedMixes[index];
  if (!source) {
    return library;
  }

  const savedMixes = [...library.savedMixes];
  savedMixes.splice(index + 1, 0, { ...source, id, name: `${source.name} copy`, updatedAt });
  return { ...library, savedMixes };
}

export function deleteMix(library: MixLibrary, mixKey: string): MixLibrary {
  const deleted = library.savedMixes.find(mix => mix.id === mixKey);
  const savedMixes = library.savedMixes.filter(mix => mix.id !== mixKey);

  if (!deleted || library.currentMixKey !== mixKey) {
    return { ...library, savedMixes };
  }

  // Keep the tracks that are playing on the table rather than clearing them out from under the user.
  return { currentMixKey: DRAFT_MIX_KEY, draft: toPersistedMix(deleted), savedMixes };
}

export function restoreMix(library: MixLibrary, { mix, index, wasCurrent }: DeletedMix): MixLibrary {
  const restored = wasCurrent ? { ...mix, ...toPersistedMix(library.draft) } : mix;
  const savedMixes = [...library.savedMixes];
  savedMixes.splice(Math.min(index, savedMixes.length), 0, restored);

  return wasCurrent ? { currentMixKey: mix.id, draft: createEmptyMix(), savedMixes } : { ...library, savedMixes };
}
