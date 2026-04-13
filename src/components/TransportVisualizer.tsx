import { useEffect, useMemo, useRef, useState } from "react";
import type { MixChannelState } from "../types";

type TransportVisualizerProps = {
  channelStates: MixChannelState[];
  transportPlaying: boolean;
};

const BAR_COUNT = 18;
const FRAME_INTERVAL_MS = 1000 / 28;

type BarSeed = {
  phase: number;
  sway: number;
  tilt: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createBarSeeds() {
  return Array.from({ length: BAR_COUNT }, (_, index) => ({
    phase: index * 0.61,
    sway: 1.45 + (index % 5) * 0.26,
    tilt: 0.72 + (index % 4) * 0.11,
  })) satisfies BarSeed[];
}

export function TransportVisualizer({
  channelStates,
  transportPlaying,
}: TransportVisualizerProps) {
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 0.12),
  );
  const profile = useMemo(() => {
    const activeLevels = transportPlaying
      ? channelStates
          .filter((channel) => !channel.paused && channel.effectiveVolume > 0)
          .map((channel) => channel.effectiveVolume / 100)
      : [];
    const averageLevel =
      activeLevels.length > 0
        ? activeLevels.reduce((sum, value) => sum + value, 0) /
          activeLevels.length
        : 0;
    const peakLevel =
      activeLevels.length > 0 ? Math.max(...activeLevels) : 0;

    return {
      activeCount: activeLevels.length,
      activeLevels,
      averageLevel,
      peakLevel,
    };
  }, [channelStates, transportPlaying]);
  const seedsRef = useRef<BarSeed[]>(createBarSeeds());
  const profileRef = useRef(profile);
  const energyRef = useRef(0);

  profileRef.current = profile;

  useEffect(() => {
    let animationFrameId = 0;
    let lastFrameAt = 0;

    const animate = (timestamp: number) => {
      if (timestamp - lastFrameAt < FRAME_INTERVAL_MS) {
        animationFrameId = window.requestAnimationFrame(animate);
        return;
      }

      lastFrameAt = timestamp;

      const { activeCount, activeLevels, averageLevel, peakLevel } =
        profileRef.current;
      const targetEnergy = transportPlaying
        ? clamp(averageLevel * 1.05 + peakLevel * 0.2, 0, 1)
        : 0;

      energyRef.current += (targetEnergy - energyRef.current) * 0.1;

      const nextLevels = seedsRef.current.map((seed, index) => {
        const barPosition = index / (BAR_COUNT - 1);
        const channelLevel =
          activeLevels.length > 0 ? activeLevels[index % activeLevels.length]! : 0;
        const arch = Math.sin(barPosition * Math.PI);
        const pulseA =
          (Math.sin(timestamp / 1000.2 * seed.sway + seed.phase) + 1) / 2;
        const pulseB =
          (Math.sin(timestamp / 640 * (seed.tilt + activeCount * 0.07) - index * 0.42) +
            1) /
          2;
        const shimmer =
          (Math.sin(timestamp / 420 - barPosition * 8.6 + seed.phase * 0.8) + 1) /
          2;
        const baseHeight = transportPlaying ? 0.08 : 0.05;
        const contour = 0.1 + arch * 0.22;
        const motion =
          pulseA * 0.42 + pulseB * 0.33 + shimmer * 0.25 + channelLevel * 0.35;
        const lift =
          energyRef.current * (0.2 + motion * 0.58) +
          peakLevel * 0.08 +
          channelLevel * 0.18;

        return clamp(baseHeight + contour + lift, 0.06, 0.98);
      });

      setLevels(nextLevels);
      animationFrameId = window.requestAnimationFrame(animate);
    };

    animationFrameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [transportPlaying]);

  const live = transportPlaying && profile.activeCount > 0;

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.22),_transparent_58%),linear-gradient(180deg,_#ffffff,_#eff6ff)] p-4">
      <div className="pointer-events-none absolute inset-x-4 top-3 h-16 rounded-full bg-blue-200/30 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Transport
          </p>
          <p className="mt-2 text-sm font-medium text-slate-600">
            {live
              ? `${profile.activeCount} active channels playing`
              : transportPlaying
                ? "Waiting for a channel to become audible"
                : "Playback paused"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
            live
              ? "bg-blue-600 text-white"
              : "bg-white/80 text-slate-500 ring-1 ring-slate-200"
          }`}
        >
          {live ? "Live" : transportPlaying ? "Idle" : "Paused"}
        </span>
      </div>

      <div className="relative mt-4 h-24 overflow-hidden rounded-[22px] border border-white/70 bg-slate-950 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.3),_transparent_46%),linear-gradient(180deg,_rgba(15,23,42,0.7),_rgba(2,6,23,0.96))]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
        <div className="relative flex h-full items-end gap-1">
          {levels.map((level, index) => (
            <span
              key={index}
              className="block flex-1 rounded-full bg-[linear-gradient(180deg,_#bfdbfe,_#60a5fa_55%,_#2563eb)] shadow-[0_0_18px_rgba(96,165,250,0.3)] transition-[height,opacity,transform] duration-200 ease-out"
              style={{
                height: `${Math.round(level * 100)}%`,
                opacity: live ? 0.78 + (index % 4) * 0.05 : 0.3,
                transform: `scaleY(${live ? 1 : 0.92}) translateY(${live ? "0px" : "2px"})`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
