import { DRAFT_MIX_KEY, type DeletedMix, type MixLibrary, type PersistedMix, type SavedMix } from "../types";
import { createEmptyMix } from "./mixStorage";

function toPersistedMix({
  name,
  channels,
  masterVolume,
  transportPlaying,
  focusedChannelId,
}: PersistedMix): PersistedMix {
  return { name, channels, masterVolume, transportPlaying, focusedChannelId };
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

export function selectMix(library: MixLibrary, mixKey: string): MixLibrary {
  const keepPlaying = getCurrentMix(library).transportPlaying;
  const selected = { ...library, currentMixKey: mixKey };

  return updateMix(selected, mixKey, mix => ({
    ...mix,
    transportPlaying: mix.channels.length > 0 && (keepPlaying || mix.transportPlaying),
  }));
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
