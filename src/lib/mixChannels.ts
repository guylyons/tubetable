import type { MixChannel, MixChannelState, PlayerStatus, YouTubeSearchResult } from "../types";
import { formatPlaybackTime, parseDurationText } from "./youtube";

const DEFAULT_CHANNEL_VOLUME = 76;

export function createChannel(video: YouTubeSearchResult): MixChannel {
  const fallbackId = `${video.videoId}-${Date.now()}`;
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : fallbackId;

  return {
    id,
    video,
    volume: DEFAULT_CHANNEL_VOLUME,
    muted: false,
    solo: false,
    paused: false,
    looped: true,
    progressSeconds: 0,
    durationSeconds: parseDurationText(video.durationText),
  };
}

export function buildChannelStates(channels: MixChannel[], masterVolume: number): MixChannelState[] {
  const hasSoloChannel = channels.some(channel => channel.solo);

  return channels.map(channel => {
    const silencedBy = channel.muted ? "mute" : hasSoloChannel && !channel.solo ? "solo" : null;

    return {
      ...channel,
      silencedBy,
      effectiveVolume: silencedBy ? 0 : Math.round((channel.volume * masterVolume) / 100),
    };
  });
}

function reorderChannels(channels: MixChannel[], draggedChannelId: string, targetChannelId: string) {
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

export function moveChannel(channels: MixChannel[], channelId: string, direction: -1 | 1) {
  const index = channels.findIndex(channel => channel.id === channelId);
  const target = channels[index + direction];

  return index === -1 || !target ? channels : reorderChannels(channels, channelId, target.id);
}

export function setAllPaused(channels: MixChannel[], paused: boolean) {
  return channels.map(channel => ({ ...channel, paused }));
}

// Ableton-style clip colors, one per channel slot.
const CHANNEL_COLORS = ["#ffc46b", "#c8a6f6", "#7ee6c5", "#8ec8ff", "#ff9fb4"];

export function getChannelColor(index: number) {
  return CHANNEL_COLORS[index % CHANNEL_COLORS.length]!;
}

export type ChannelStatus = { label: string; tone: "live" | "idle" | "busy" | "error" };

export function getChannelStatus(status: PlayerStatus | undefined, channel: MixChannelState): ChannelStatus {
  switch (status) {
    case "playing":
      return {
        label: channel.silencedBy === "mute" ? "Muted" : channel.silencedBy === "solo" ? "Off (solo)" : "Playing",
        tone: "live",
      };
    case "buffering":
      return { label: "Buffering", tone: "busy" };
    case "error":
      return { label: "Unavailable", tone: "error" };
    case "ended":
      return { label: channel.looped ? "Paused" : "Ended", tone: "idle" };
    case "paused":
      return { label: "Paused", tone: "idle" };
    default:
      return { label: "Loading", tone: "busy" };
  }
}

export function isChannelPlaying(status: PlayerStatus | undefined) {
  return status === "playing" || status === "buffering";
}

export function formatSessionSummary(channels: MixChannel[]) {
  if (channels.length === 0) {
    return "No tracks";
  }

  const tracks = `${channels.length} ${channels.length === 1 ? "track" : "tracks"}`;
  const longest = Math.max(...channels.map(channel => channel.durationSeconds));
  return longest > 0 ? `${tracks} • ${formatPlaybackTime(longest)}` : tracks;
}
