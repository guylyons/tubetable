import type { MixChannelState } from "../types";

export const BAR_COUNT = 32;
const BEAT_BPM = 94;

type VisualizerTrack = {
  level: number;
  progressSeconds: number;
  slot: number;
};

export type VisualizerProfile = {
  activeCount: number;
  averageLevel: number;
  peakLevel: number;
  tracks: VisualizerTrack[];
};

export type BandActivity = {
  low: number;
  mid: number;
  high: number;
};

type CalculateVisualizerLevelsInput = {
  energy: number;
  previousLevels: number[];
  profile: VisualizerProfile;
  timestamp: number;
};

type CalculateVisualizerLevelsResult = {
  bandActivity: BandActivity;
  energy: number;
  levels: number[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBand(index: number) {
  const position = index / (BAR_COUNT - 1);
  if (position < 0.34) {
    return "low" as const;
  }
  if (position < 0.68) {
    return "mid" as const;
  }
  return "high" as const;
}

function bandWeight(track: VisualizerTrack, band: keyof BandActivity) {
  const bandIndex = band === "low" ? 0 : band === "mid" ? 1 : 2;
  const trackBand = track.slot % 3;

  if (trackBand === bandIndex) {
    return band === "mid" ? 0.9 : 1;
  }

  if (band === "low") {
    return 0.35 + (1 - track.level) * 0.35;
  }

  if (band === "high") {
    return 0.35 + track.level * 0.65;
  }

  return 0.48;
}

function calculateBandActivity(tracks: VisualizerTrack[]) {
  const activity: BandActivity = { low: 0, mid: 0, high: 0 };

  tracks.forEach((track) => {
    activity.low += track.level * bandWeight(track, "low");
    activity.mid += track.level * bandWeight(track, "mid");
    activity.high += track.level * bandWeight(track, "high");
  });

  return {
    low: clamp(activity.low / Math.max(1, tracks.length), 0, 1),
    mid: clamp(activity.mid / Math.max(1, tracks.length), 0, 1),
    high: clamp(activity.high / Math.max(1, tracks.length), 0, 1),
  };
}

export function buildVisualizerProfile(
  channelStates: MixChannelState[],
  transportPlaying: boolean,
): VisualizerProfile {
  const tracks = transportPlaying
    ? channelStates
        .filter(
          (channel) =>
            !channel.paused && !channel.muted && channel.effectiveVolume > 0,
        )
        .map((channel, slot) => ({
          level: clamp(channel.effectiveVolume / 100, 0, 1),
          progressSeconds: Math.max(0, channel.progressSeconds),
          slot,
        }))
    : [];
  const averageLevel =
    tracks.length > 0
      ? tracks.reduce((sum, track) => sum + track.level, 0) / tracks.length
      : 0;
  const peakLevel =
    tracks.length > 0 ? Math.max(...tracks.map((track) => track.level)) : 0;

  return {
    activeCount: tracks.length,
    averageLevel,
    peakLevel,
    tracks,
  };
}

export function calculateVisualizerLevels({
  energy,
  previousLevels,
  profile,
  timestamp,
}: CalculateVisualizerLevelsInput): CalculateVisualizerLevelsResult {
  if (profile.tracks.length === 0) {
    return {
      bandActivity: { low: 0, mid: 0, high: 0 },
      energy: 0,
      levels: Array.from({ length: BAR_COUNT }, (_, index) => {
        const idleDrift =
          (Math.sin(timestamp / 900 + index * 0.48) + 1) * 0.025;
        return clamp(0.06 + idleDrift, 0.05, 0.14);
      }),
    };
  }

  const targetEnergy = clamp(
    profile.averageLevel * 0.78 + profile.peakLevel * 0.28,
    0,
    1,
  );
  const nextEnergy = energy + (targetEnergy - energy) * 0.38;
  const bandActivity = calculateBandActivity(profile.tracks);

  const levels = Array.from({ length: BAR_COUNT }, (_, index) => {
    const previousLevel = previousLevels[index] ?? 0.12;
    const position = index / (BAR_COUNT - 1);
    const band = getBand(index);
    const track = profile.tracks[index % profile.tracks.length]!;
    const beatProgress =
      (((track.progressSeconds + timestamp / 1000) * BEAT_BPM) / 60 +
        track.slot * 0.19 +
        index * 0.011) %
      1;
    const kick = Math.pow(1 - beatProgress, 4);
    const offbeat = Math.pow(1 - Math.abs(beatProgress - 0.5) * 2, 3);
    const arch = Math.sin(position * Math.PI);
    const ripple =
      (Math.sin(timestamp / (480 + track.slot * 90) + index * 0.58) + 1) / 2;
    const bandLift = bandActivity[band] * (0.24 + arch * 0.14);
    const trackLift = track.level * bandWeight(track, band) * 0.25;
    const beatLift = (kick * 0.5 + offbeat * 0.16) * (0.45 + track.level);
    const target = clamp(
      0.07 +
        arch * 0.16 +
        ripple * 0.12 +
        nextEnergy * 0.18 +
        bandLift +
        trackLift +
        beatLift,
      0.06,
      0.98,
    );

    return clamp(previousLevel + (target - previousLevel) * 0.58, 0.06, 0.98);
  });

  return {
    bandActivity,
    energy: nextEnergy,
    levels,
  };
}
