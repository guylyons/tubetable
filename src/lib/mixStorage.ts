import {
  DRAFT_MIX_KEY,
  MAX_CHANNELS,
  STORAGE_KEY,
  type MixChannel,
  type MixLibrary,
  type PersistedMix,
  type SavedMix,
} from "../types";

const EXAMPLE_MIX_NAME = "Example Mix";
const EXAMPLE_MIX_ID = "example-mix";
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
    progressSeconds: 0,
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
    progressSeconds: 0,
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
    progressSeconds: 0,
  },
];

function createExampleMix(): PersistedMix {
  return {
    name: EXAMPLE_MIX_NAME,
    channels: EXAMPLE_CHANNELS,
    masterVolume: 100,
    transportPlaying: false,
    focusedChannelId: null,
  };
}

function createExampleSavedMix(): SavedMix {
  return {
    ...createExampleMix(),
    id: EXAMPLE_MIX_ID,
    updatedAt: new Date().toISOString(),
  };
}

function createDefaultMixState(): MixLibrary {
  return {
    currentMixKey: EXAMPLE_MIX_ID,
    draft: createEmptyMix(),
    savedMixes: [createExampleSavedMix()],
  };
}

export function createMixId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `mix-${Date.now()}`;
}

export function createEmptyMix(name = ""): PersistedMix {
  return {
    name,
    channels: [],
    masterVolume: 100,
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
    masterVolume: typeof record.masterVolume === "number" ? record.masterVolume : 100,
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
    progressSeconds: typeof record.progressSeconds === "number" ? Math.max(0, record.progressSeconds) : 0,
  };
}

function sanitizeSavedMix(value: unknown): SavedMix | null {
  const mix = sanitizePersistedMix(value);
  if (!mix) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    ...mix,
    id: typeof record.id === "string" ? record.id : createMixId(),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
  };
}

// Before autosave, edits to a saved mix lived in `draftCache` (and in `draft` for the
// current mix) until the user pressed Save. Apply them so nothing is lost.
function migrateDraftCache(record: Record<string, unknown>, draft: PersistedMix, savedMixes: SavedMix[]) {
  const rawDraftCache =
    record.draftCache && typeof record.draftCache === "object" ? (record.draftCache as Record<string, unknown>) : {};
  const currentMixKey = typeof record.currentMixKey === "string" ? record.currentMixKey : DRAFT_MIX_KEY;
  const editsByKey = new Map<string, PersistedMix>();

  for (const [key, value] of Object.entries(rawDraftCache)) {
    const mix = sanitizePersistedMix(value);
    if (mix) {
      editsByKey.set(key, mix);
    }
  }
  editsByKey.set(currentMixKey, draft);

  return {
    draft: editsByKey.get(DRAFT_MIX_KEY) ?? createEmptyMix(),
    savedMixes: savedMixes.map(mix => {
      const edits = editsByKey.get(mix.id);
      return edits ? { ...mix, ...edits } : mix;
    }),
  };
}

export function readStoredMixState(): MixLibrary {
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
    const storedDraft = sanitizePersistedMix(record?.draft);

    if (!storedDraft) {
      const legacyMix = sanitizePersistedMix(parsed);
      return legacyMix ? { currentMixKey: DRAFT_MIX_KEY, draft: legacyMix, savedMixes: [] } : createDefaultMixState();
    }

    const storedSavedMixes = Array.isArray(record.savedMixes)
      ? record.savedMixes.map(sanitizeSavedMix).filter((mix): mix is SavedMix => mix !== null)
      : [];
    const { draft, savedMixes } =
      "draftCache" in record
        ? migrateDraftCache(record, storedDraft, storedSavedMixes)
        : { draft: storedDraft, savedMixes: storedSavedMixes };
    const currentMixKey =
      typeof record.currentMixKey === "string" && savedMixes.some(mix => mix.id === record.currentMixKey)
        ? record.currentMixKey
        : DRAFT_MIX_KEY;

    return {
      currentMixKey,
      draft,
      savedMixes: savedMixes.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    };
  } catch {
    return createDefaultMixState();
  }
}
