import {
  DRAFT_MIX_KEY,
  MAX_CHANNELS,
  STORAGE_KEY,
  type MixChannel,
  type MixStorage,
  type PersistedMix,
  type SavedMix,
} from "../types";
import { DEFAULT_TRACK_EFFECTS } from "./mixChannels";

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
    playbackRate: 1,
    ...DEFAULT_TRACK_EFFECTS,
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
    playbackRate: 1,
    ...DEFAULT_TRACK_EFFECTS,
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
    playbackRate: 1,
    ...DEFAULT_TRACK_EFFECTS,
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
  const channelIds = new Set(channels.map(channel => channel.id));
  const normalizedChannels = channels.map(channel => ({
    ...channel,
    beatSyncSourceChannelId:
      channel.beatSyncSourceChannelId &&
      channel.beatSyncSourceChannelId !== channel.id &&
      channelIds.has(channel.beatSyncSourceChannelId)
        ? channel.beatSyncSourceChannelId
        : null,
  }));

  return {
    name: typeof record.name === "string" ? record.name : "",
    channels: normalizedChannels,
    masterVolume: typeof record.masterVolume === "number" ? record.masterVolume : 82,
    transportPlaying: Boolean(record.transportPlaying),
    focusedChannelId:
      typeof record.focusedChannelId === "string" && normalizedChannels.some(channel => channel.id === record.focusedChannelId)
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
    playbackRate: clampPlaybackRate(typeof record.playbackRate === "number" ? record.playbackRate : 1),
    reverbEnabled: Boolean(record.reverbEnabled),
    reverbMix: clampPercent(record.reverbMix, DEFAULT_TRACK_EFFECTS.reverbMix),
    reverbDecay: clampPercent(record.reverbDecay, DEFAULT_TRACK_EFFECTS.reverbDecay),
    reverbPreDelayMs: clampNumber(record.reverbPreDelayMs, DEFAULT_TRACK_EFFECTS.reverbPreDelayMs, 0, 200),
    delayEnabled: Boolean(record.delayEnabled),
    delayMix: clampPercent(record.delayMix, DEFAULT_TRACK_EFFECTS.delayMix),
    delayFeedback: clampPercent(record.delayFeedback, DEFAULT_TRACK_EFFECTS.delayFeedback),
    delayTimeMs: clampNumber(record.delayTimeMs, DEFAULT_TRACK_EFFECTS.delayTimeMs, 20, 900),
    lofiEnabled: Boolean(record.lofiEnabled),
    lofiMix: clampPercent(record.lofiMix, DEFAULT_TRACK_EFFECTS.lofiMix),
    lofiCutoffHz: clampNumber(record.lofiCutoffHz, DEFAULT_TRACK_EFFECTS.lofiCutoffHz, 300, 12000),
    pitchShiftEnabled: Boolean(record.pitchShiftEnabled),
    pitchShiftSemitones: clampNumber(record.pitchShiftSemitones, DEFAULT_TRACK_EFFECTS.pitchShiftSemitones, -12, 12),
    beatSyncSourceChannelId:
      typeof record.beatSyncSourceChannelId === "string" ? record.beatSyncSourceChannelId : null,
    beatSyncOffsetBeats:
      typeof record.beatSyncOffsetBeats === "number" && Number.isFinite(record.beatSyncOffsetBeats)
        ? record.beatSyncOffsetBeats
        : null,
    tempoBpm:
      typeof record.tempoBpm === "number" && Number.isFinite(record.tempoBpm)
        ? clampNumber(record.tempoBpm, 120, 40, 240)
        : null,
    muted: record.muted,
    solo: record.solo,
    paused: record.paused,
    looped: typeof record.looped === "boolean" ? record.looped : true,
    progressSeconds: typeof record.progressSeconds === "number" ? Math.max(0, record.progressSeconds) : 0,
  };
}

function clampPlaybackRate(value: number) {
  return Math.min(2, Math.max(0.5, value));
}

function clampPercent(value: unknown, fallback: number) {
  return clampNumber(value, fallback, 0, 100);
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
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
      const channelIds = new Set(draft.channels.map(channel => channel.id));
      const normalizedDraft = {
        ...draft,
        channels: draft.channels.map(channel => ({
          ...channel,
          beatSyncSourceChannelId:
            channel.beatSyncSourceChannelId && channel.beatSyncSourceChannelId !== channel.id && channelIds.has(channel.beatSyncSourceChannelId)
              ? channel.beatSyncSourceChannelId
              : null,
        })),
      };
      const currentMixKey = typeof record.currentMixKey === "string" ? record.currentMixKey : DRAFT_MIX_KEY;

      return {
        currentMixKey,
        draft: normalizedDraft,
        draftCache: {
          [DRAFT_MIX_KEY]: createEmptyMix(),
          ...draftCache,
          [currentMixKey]: normalizedDraft,
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
