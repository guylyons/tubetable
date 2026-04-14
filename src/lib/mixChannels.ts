import type { MixChannel, MixChannelState, YouTubeSearchResult } from "../types";

export const DEFAULT_TRACK_EFFECTS = {
  delayEnabled: false,
  delayFeedback: 36,
  delayMix: 28,
  delayTimeMs: 290,
  lofiCutoffHz: 2400,
  lofiEnabled: false,
  lofiMix: 40,
  pitchShiftEnabled: false,
  pitchShiftSemitones: 0,
  beatSyncSourceChannelId: null,
  beatSyncOffsetBeats: null,
  tempoBpm: null,
  reverbDecay: 55,
  reverbEnabled: false,
  reverbMix: 22,
  reverbPreDelayMs: 12,
} satisfies Omit<
  MixChannel,
  | "id"
  | "video"
  | "volume"
  | "playbackRate"
  | "muted"
  | "solo"
  | "paused"
  | "looped"
  | "progressSeconds"
>;

export function createChannel(video: YouTubeSearchResult): MixChannel {
  const fallbackId = `${video.videoId}-${Date.now()}`;
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : fallbackId;

  return {
    id,
    video,
    volume: 76,
    playbackRate: 1,
    ...DEFAULT_TRACK_EFFECTS,
    beatSyncSourceChannelId: null,
    beatSyncOffsetBeats: null,
    tempoBpm: null,
    muted: false,
    solo: false,
    paused: false,
    looped: true,
    progressSeconds: 0,
  };
}

export function getTransportLabel(playing: boolean) {
  return playing ? "Pause mix" : "Play mix";
}

export function clampTempoBpm(value: number) {
  return Math.min(240, Math.max(40, value));
}

export function getBeatLengthSeconds(tempoBpm: number | null | undefined) {
  if (typeof tempoBpm !== "number" || !Number.isFinite(tempoBpm) || tempoBpm <= 0) {
    return null;
  }

  return 60 / tempoBpm;
}

export function getBeatPosition(seconds: number, tempoBpm: number | null | undefined) {
  const beatLengthSeconds = getBeatLengthSeconds(tempoBpm);
  if (beatLengthSeconds === null) {
    return null;
  }

  return seconds / beatLengthSeconds;
}

export function getSyncedPlaybackRate(sourceTempoBpm: number, targetTempoBpm: number) {
  return Math.min(2, Math.max(0.5, sourceTempoBpm / targetTempoBpm));
}

export function getSyncedProgressSeconds({
  beatOffsetBeats = 0,
  sourceProgressSeconds,
  sourceTempoBpm,
  targetTempoBpm,
}: {
  beatOffsetBeats?: number;
  sourceProgressSeconds: number;
  sourceTempoBpm: number;
  targetTempoBpm: number;
}) {
  const sourceBeatLengthSeconds = getBeatLengthSeconds(sourceTempoBpm);
  const targetBeatLengthSeconds = getBeatLengthSeconds(targetTempoBpm);
  if (sourceBeatLengthSeconds === null || targetBeatLengthSeconds === null) {
    return null;
  }

  const sourceBeatPosition = sourceProgressSeconds / sourceBeatLengthSeconds;
  return (sourceBeatPosition + beatOffsetBeats) * targetBeatLengthSeconds;
}

export function getBeatOffsetBeats({
  sourceProgressSeconds,
  sourceTempoBpm,
  targetProgressSeconds,
  targetTempoBpm,
}: {
  sourceProgressSeconds: number;
  sourceTempoBpm: number;
  targetProgressSeconds: number;
  targetTempoBpm: number;
}) {
  const sourceBeatPosition = getBeatPosition(sourceProgressSeconds, sourceTempoBpm);
  const targetBeatPosition = getBeatPosition(targetProgressSeconds, targetTempoBpm);
  if (sourceBeatPosition === null || targetBeatPosition === null) {
    return 0;
  }

  return targetBeatPosition - sourceBeatPosition;
}

export function buildChannelStates(channels: MixChannel[], masterVolume: number): MixChannelState[] {
  const hasSoloChannel = channels.some(channel => channel.solo);

  return channels.map(channel => ({
    ...channel,
    effectiveVolume:
      channel.muted || channel.paused || (hasSoloChannel && !channel.solo)
        ? 0
        : Math.round((channel.volume * masterVolume) / 100),
  }));
}

export function reorderChannels(channels: MixChannel[], draggedChannelId: string, targetChannelId: string) {
  if (draggedChannelId === targetChannelId) {
    return channels;
  }

  const draggedIndex = channels.findIndex(channel => channel.id === draggedChannelId);
  const targetIndex = channels.findIndex(channel => channel.id === targetChannelId);

  if (draggedIndex === -1 || targetIndex === -1) {
    return channels;
  }

  const nextChannels = [...channels];
  const [draggedChannel] = nextChannels.splice(draggedIndex, 1);

  if (!draggedChannel) {
    return channels;
  }

  nextChannels.splice(targetIndex, 0, draggedChannel);
  return nextChannels;
}
