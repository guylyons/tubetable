import {
  DRAFT_MIX_KEY,
  MAX_CHANNELS,
  STORAGE_KEY,
  type MixChannel,
  type MixStorage,
  type PersistedMix,
  type SavedMix,
} from "../types";

export function createMixId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `mix-${Date.now()}`;
}

export function createEmptyMix(name = ""): PersistedMix {
  return {
    name,
    channels: [],
    masterVolume: 82,
    transportPlaying: false,
  };
}

export function sanitizePersistedMix(value: unknown): PersistedMix | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.channels)) {
    return null;
  }

  const channels = record.channels
    .map(channel => sanitizeMixChannel(channel))
    .filter((channel): channel is MixChannel => channel !== null)
    .slice(0, MAX_CHANNELS);

  return {
    name: typeof record.name === "string" ? record.name : "",
    channels,
    masterVolume: typeof record.masterVolume === "number" ? record.masterVolume : 82,
    transportPlaying: Boolean(record.transportPlaying),
  };
}

function sanitizeMixChannel(value: unknown): MixChannel | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const video = record.video;
  if (!video || typeof video !== "object") {
    return null;
  }

  const videoRecord = video as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.volume !== "number" ||
    typeof record.muted !== "boolean" ||
    typeof record.solo !== "boolean" ||
    typeof record.paused !== "boolean" ||
    typeof videoRecord.videoId !== "string" ||
    typeof videoRecord.title !== "string" ||
    typeof videoRecord.channelTitle !== "string" ||
    typeof videoRecord.thumbnail !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    video: {
      videoId: videoRecord.videoId,
      title: videoRecord.title,
      channelTitle: videoRecord.channelTitle,
      thumbnail: videoRecord.thumbnail,
      durationText: typeof videoRecord.durationText === "string" ? videoRecord.durationText : undefined,
      viewCountText: typeof videoRecord.viewCountText === "string" ? videoRecord.viewCountText : undefined,
    },
    volume: record.volume,
    muted: record.muted,
    solo: record.solo,
    paused: record.paused,
    looped: typeof record.looped === "boolean" ? record.looped : true,
  };
}

export function readStoredMixState(): MixStorage {
  const emptyMix = createEmptyMix();

  if (typeof window === "undefined") {
    return {
      currentMixKey: DRAFT_MIX_KEY,
      draft: emptyMix,
      draftCache: { [DRAFT_MIX_KEY]: emptyMix },
      savedMixes: [],
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        currentMixKey: DRAFT_MIX_KEY,
        draft: emptyMix,
        draftCache: { [DRAFT_MIX_KEY]: emptyMix },
        savedMixes: [],
      };
    }

    const parsed = JSON.parse(raw) as unknown;
    const record = parsed as Record<string, unknown>;

    const draft = sanitizePersistedMix(record?.draft);
    const savedMixes = Array.isArray(record?.savedMixes)
      ? record.savedMixes
          .map(item => {
            const mix = sanitizePersistedMix(item);
            if (!mix || !item || typeof item !== "object") {
              return null;
            }

            const entry = item as Record<string, unknown>;
            return {
              ...mix,
              id: typeof entry.id === "string" ? entry.id : createMixId(),
              updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : new Date().toISOString(),
            } satisfies SavedMix;
          })
          .filter((item): item is SavedMix => item !== null)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      : [];

    const rawDraftCache =
      record?.draftCache && typeof record.draftCache === "object" ? (record.draftCache as Record<string, unknown>) : {};
    const draftCache = Object.fromEntries(
      Object.entries(rawDraftCache)
        .map(([key, value]) => {
          const mix = sanitizePersistedMix(value);
          return mix ? ([key, mix] as const) : null;
        })
        .filter((entry): entry is readonly [string, PersistedMix] => entry !== null),
    );

    if (draft) {
      const currentMixKey = typeof record.currentMixKey === "string" ? record.currentMixKey : DRAFT_MIX_KEY;

      return {
        currentMixKey,
        draft,
        draftCache: {
          [DRAFT_MIX_KEY]: emptyMix,
          ...draftCache,
          [currentMixKey]: draft,
        },
        savedMixes,
      };
    }

    const legacyMix = sanitizePersistedMix(parsed);
    if (legacyMix) {
      return {
        currentMixKey: DRAFT_MIX_KEY,
        draft: legacyMix,
        draftCache: { [DRAFT_MIX_KEY]: legacyMix },
        savedMixes: [],
      };
    }

    return {
      currentMixKey: DRAFT_MIX_KEY,
      draft: emptyMix,
      draftCache: { [DRAFT_MIX_KEY]: emptyMix },
      savedMixes: [],
    };
  } catch {
    return {
      currentMixKey: DRAFT_MIX_KEY,
      draft: emptyMix,
      draftCache: { [DRAFT_MIX_KEY]: emptyMix },
      savedMixes: [],
    };
  }
}
