import {
  DRAFT_MIX_KEY,
  MAX_CHANNELS,
  STORAGE_KEY,
  type MixChannel,
  type MixStorage,
  type PersistedMix,
  type SavedMix,
} from "../types";

const EXAMPLE_MIX_NAME = "Example Mix";
const EXAMPLE_MIX_ID = "example-mix";
const EXAMPLE_UPDATED_AT = "2024-01-01T00:00:00.000Z";
const EXAMPLE_CHANNELS: MixChannel[] = [
  {
    id: "example-channel-1",
    video: {
      videoId: "CxHa5KaMBcM",
      title: "5 Hours of The Shipping Forecast on BBC Radio 4!",
      channelTitle: "BBC Radio 4",
      thumbnail: "https://i.ytimg.com/vi/CxHa5KaMBcM/hqdefault.jpg",
    },
    volume: 76,
    muted: false,
    solo: false,
    paused: false,
    looped: true,
  },
  {
    id: "example-channel-2",
    video: {
      videoId: "vNwYtllyt3Q",
      title: "Brian Eno - Ambient 1: Music for Airports [Full Album]",
      channelTitle: "Brian Eno",
      thumbnail: "https://i.ytimg.com/vi/vNwYtllyt3Q/hqdefault.jpg",
    },
    volume: 76,
    muted: false,
    solo: false,
    paused: false,
    looped: true,
  },
  {
    id: "example-channel-3",
    video: {
      videoId: "mPZkdNFkNps",
      title: "Rain Sound On Window with Thunder Sounds | Heavy Rain for Sleep, Study and Relaxation, Meditation",
      channelTitle: "BIRDZ",
      thumbnail: "https://i.ytimg.com/vi/mPZkdNFkNps/hqdefault.jpg",
    },
    volume: 76,
    muted: false,
    solo: false,
    paused: false,
    looped: true,
  },
];

function createExampleMix(): PersistedMix {
  return {
    name: EXAMPLE_MIX_NAME,
    channels: EXAMPLE_CHANNELS,
    masterVolume: 82,
    transportPlaying: false,
    focusedChannelId: null,
  };
}

function createExampleSavedMix(): SavedMix {
  return {
    ...createExampleMix(),
    id: EXAMPLE_MIX_ID,
    updatedAt: EXAMPLE_UPDATED_AT,
  };
}

function ensureExampleSavedMix(savedMixes: SavedMix[]): SavedMix[] {
  return savedMixes.some(mix => mix.id === EXAMPLE_MIX_ID)
    ? savedMixes
    : [createExampleSavedMix(), ...savedMixes];
}

function createDefaultMixState(): MixStorage {
  const exampleMix = createExampleMix();
  const exampleSavedMix = createExampleSavedMix();

  return {
    currentMixKey: EXAMPLE_MIX_ID,
    draft: exampleMix,
    draftCache: {
      [DRAFT_MIX_KEY]: createEmptyMix(),
      [EXAMPLE_MIX_ID]: exampleMix,
    },
    savedMixes: [exampleSavedMix],
  };
}

export function createMixId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `mix-${Date.now()}`;
}

export function createEmptyMix(name = ""): PersistedMix {
  return {
    name,
    channels: [],
    masterVolume: 82,
    transportPlaying: false,
    focusedChannelId: null,
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
    focusedChannelId:
      typeof record.focusedChannelId === "string" && channels.some(channel => channel.id === record.focusedChannelId)
        ? record.focusedChannelId
        : null,
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
  if (typeof window === "undefined") {
    return createDefaultMixState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultMixState();
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
    const normalizedSavedMixes = ensureExampleSavedMix(savedMixes);

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
          [DRAFT_MIX_KEY]: createEmptyMix(),
          ...draftCache,
          [currentMixKey]: draft,
        },
        savedMixes: normalizedSavedMixes,
      };
    }

    const legacyMix = sanitizePersistedMix(parsed);
    if (legacyMix) {
      return {
        currentMixKey: DRAFT_MIX_KEY,
        draft: legacyMix,
        draftCache: { [DRAFT_MIX_KEY]: legacyMix },
        savedMixes: ensureExampleSavedMix([]),
      };
    }

    return createDefaultMixState();
  } catch {
    return createDefaultMixState();
  }
}
