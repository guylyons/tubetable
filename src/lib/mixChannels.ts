import type { MixChannel, MixChannelState, YouTubeSearchResult } from "../types";

export function createChannel(video: YouTubeSearchResult): MixChannel {
  const fallbackId = `${video.videoId}-${Date.now()}`;
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : fallbackId;

  return {
    id,
    video,
    volume: 76,
    muted: false,
    solo: false,
    paused: false,
    looped: true,
  };
}

export function getTransportLabel(playing: boolean) {
  return playing ? "Pause mix" : "Play mix";
}

export function buildChannelStates(channels: MixChannel[], masterVolume: number): MixChannelState[] {
  const hasSoloChannel = channels.some(channel => channel.solo);

  return channels.map(channel => ({
    ...channel,
    effectiveVolume:
      channel.muted || (hasSoloChannel && !channel.solo) ? 0 : Math.round((channel.volume * masterVolume) / 100),
  }));
}
