import {
  DRAFT_MIX_KEY,
  MAX_CHANNELS,
  STORAGE_KEY,
  type MixChannel,
  type MixLibrary,
  type PersistedMix,
  type SavedMix,
} from "../types";
import { createChannel, setAllPaused } from "./mixChannels";
import { parseDurationText } from "./youtube";

const EXAMPLE_MIX_NAME = "Example Mix";
const EXAMPLE_MIX_ID = "example-mix";
const EXAMPLE_VIDEOS = [
  ["CxHa5KaMBcM", "5 Hours of The Shipping Forecast on BBC Radio 4!", "BBC Radio 4"],
  ["vNwYtllyt3Q", "Brian Eno - Ambient 1: Music for Airports [Full Album]", "Brian Eno"],
  [
    "mPZkdNFkNps",
    "Rain Sound On Window with Thunder Sounds | Heavy Rain for Sleep, Study and Relaxation, Meditation",
    "BIRDZ",
  ],
] as const;
const EXAMPLE_CHANNELS: MixChannel[] = EXAMPLE_VIDEOS.map(([videoId, title, channelTitle], index) => ({
  ...createChannel({ videoId, title, channelTitle, thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }),
  id: `example-channel-${index + 1}`,
}));

function createExampleMix(): PersistedMix {
  return {
    name: EXAMPLE_MIX_NAME,
    channels: EXAMPLE_CHANNELS,
    masterVolume: 100,
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
    durationSeconds:
      typeof record.durationSeconds === "number" && record.durationSeconds > 0
        ? record.durationSeconds
        : parseDurationText(typeof videoRecord.durationText === "string" ? videoRecord.durationText : undefined),
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

function pauseEverything(library: MixLibrary): MixLibrary {
  const pause = <T extends PersistedMix>(mix: T): T => ({ ...mix, channels: setAllPaused(mix.channels, true) });

  return { ...library, draft: pause(library.draft), savedMixes: library.savedMixes.map(pause) };
}

// Everything loads paused: browsers block sound until the user presses play.
export function readStoredMixState(): MixLibrary {
  return pauseEverything(readStoredLibrary());
}

function readStoredLibrary(): MixLibrary {
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
