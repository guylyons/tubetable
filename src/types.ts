export type YouTubeSearchResult = {
  videoId: string;
  title: string;
  channelTitle: string;
  durationText?: string;
  viewCountText?: string;
  thumbnail: string;
};

export type YouTubeSearchPayload = {
  results: YouTubeSearchResult[];
  suggestions: string[];
};

export type MixChannel = {
  id: string;
  video: YouTubeSearchResult;
  volume: number;
  playbackRate: number;
  reverbEnabled: boolean;
  delayEnabled: boolean;
  lofiEnabled: boolean;
  muted: boolean;
  solo: boolean;
  paused: boolean;
  looped: boolean;
  progressSeconds: number;
};

export type MixChannelState = MixChannel & {
  effectiveVolume: number;
};

export type PersistedMix = {
  name: string;
  channels: MixChannel[];
  masterVolume: number;
  transportPlaying: boolean;
  focusedChannelId: string | null;
};

export type SavedMix = PersistedMix & {
  id: string;
  updatedAt: string;
};

export type MixStorage = {
  currentMixKey: string;
  draft: PersistedMix;
  draftCache: Record<string, PersistedMix>;
  savedMixes: SavedMix[];
};

export const MAX_CHANNELS = 5;
export const DRAFT_MIX_KEY = "__draft__";
export const STORAGE_KEY = "tubetable.mix.v1";
