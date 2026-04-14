import type { MixChannel, MixChannelState, YouTubeSearchResult } from "../types";

export function createChannel(video: YouTubeSearchResult): MixChannel {
  const fallbackId = `${video.videoId}-${Date.now()}`;
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : fallbackId;

  return {
    id,
    video,
    volume: 76,
    playbackRate: 1,
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

export function buildChannelStates(channels: MixChannel[], masterVolume: number): MixChannelState[] {
  const hasSoloChannel = channels.some(channel => channel.solo);

  return channels.map(channel => ({
    ...channel,
    effectiveVolume:
      channel.muted || (hasSoloChannel && !channel.solo) ? 0 : Math.round((channel.volume * masterVolume) / 100),
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
