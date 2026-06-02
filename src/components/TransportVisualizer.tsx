import { useEffect, useMemo, useRef, useState } from "react";
import type { MixChannelState } from "../types";

type TransportVisualizerProps = {
  channelStates: MixChannelState[];
  isDarkMode: boolean;
  transportPlaying: boolean;
};

const BAR_COUNT = 24;
const FRAME_INTERVAL_MS = 1000 / 34;
const BEAT_BPM = 94;

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
    phase: index * 0.48,
    sway: 1.35 + (index % 6) * 0.18,
    tilt: 0.68 + (index % 5) * 0.09,
  })) satisfies BarSeed[];
}

export function TransportVisualizer({
  channelStates,
  isDarkMode,
  transportPlaying,
}: TransportVisualizerProps) {
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 0.12),
  );
  const profile = useMemo(() => {
    const activeLevels = transportPlaying
      ? channelStates
          .filter((channel) => !channel.paused && channel.effectiveVolume > 0)
          .map((channel) => ({
            level: channel.effectiveVolume / 100,
            progressSeconds: channel.progressSeconds,
          }))
      : [];
    const averageLevel =
      activeLevels.length > 0
        ? activeLevels.reduce((sum, channel) => sum + channel.level, 0) /
          activeLevels.length
        : 0;
    const peakLevel =
      activeLevels.length > 0
        ? Math.max(...activeLevels.map((channel) => channel.level))
        : 0;

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
        const activeChannel =
          activeLevels.length > 0
            ? activeLevels[index % activeLevels.length]!
            : null;
        const channelLevel = activeChannel?.level ?? 0;
        const beatProgress =
          activeChannel && transportPlaying
            ? (((activeChannel.progressSeconds + timestamp / 1000) *
                BEAT_BPM) /
                60 +
                index * 0.018) %
              1
            : 0;
        const kick = Math.pow(1 - beatProgress, 4);
        const offbeat = Math.pow(
          1 - Math.abs(beatProgress - 0.5) * 2,
          3,
        );
        const arch = Math.sin(barPosition * Math.PI);
        const pulseA =
          (Math.sin((timestamp / 900) * seed.sway + seed.phase) + 1) / 2;
        const pulseB =
          (Math.sin(
            (timestamp / 520) * (seed.tilt + activeCount * 0.08) - index * 0.36,
          ) +
            1) /
          2;
        const shimmer =
          (Math.sin(timestamp / 420 - barPosition * 8.6 + seed.phase * 0.8) +
            1) /
          2;
        const baseHeight = transportPlaying ? 0.08 : 0.05;
        const contour = 0.08 + arch * 0.18;
        const motion =
          pulseA * 0.22 +
          pulseB * 0.18 +
          shimmer * 0.14 +
          channelLevel * 0.24;
        const beatLift = (kick * 0.58 + offbeat * 0.18) * (0.45 + channelLevel);
        const lift =
          energyRef.current * (0.14 + motion * 0.42) +
          beatLift +
          peakLevel * 0.08 +
          channelLevel * 0.12;

        return clamp(baseHeight + contour + lift, 0.06, 0.98);
      });

      setLevels(nextLevels);
      animationFrameId = window.requestAnimationFrame(animate);
    };

    animationFrameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [transportPlaying]);

  const playing = transportPlaying && profile.activeCount > 0;

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border p-3 ${
        isDarkMode
          ? "border-slate-700 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.24),_transparent_58%),linear-gradient(180deg,_#0f172a,_#020617)]"
          : "border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.22),_transparent_58%),linear-gradient(180deg,_#ffffff,_#eff6ff)]"
      }`}
    >
      <div className={`pointer-events-none absolute inset-x-4 top-3 h-16 rounded-full blur-2xl ${isDarkMode ? "bg-sky-400/15" : "bg-blue-200/30"}`} />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-sky-300" : "text-slate-500"}`}>Visualizer</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
            playing
              ? isDarkMode
                ? "bg-sky-400 text-slate-950"
                : "bg-blue-600 text-white"
              : isDarkMode
                ? "bg-slate-900/80 text-slate-400 ring-1 ring-slate-700"
                : "bg-white/80 text-slate-500 ring-1 ring-slate-200"
          }`}
        >
          {playing ? "Playing" : transportPlaying ? "Idle" : "Paused"}
        </span>
      </div>

      <div className={`relative mt-3 h-28 overflow-hidden rounded-[22px] border px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${isDarkMode ? "border-slate-700 bg-slate-950" : "border-white/70 bg-slate-950"}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.3),_transparent_46%),linear-gradient(180deg,_rgba(15,23,42,0.7),_rgba(2,6,23,0.96))]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
        <div className="relative flex h-full items-end gap-[3px]">
          {levels.map((level, index) => (
            <span
              key={index}
              className={`block flex-1 rounded-full transition-[height,opacity,transform] duration-100 ease-out ${
                isDarkMode
                  ? "bg-[linear-gradient(180deg,_#f0f9ff,_#38bdf8_48%,_#0ea5e9_72%,_#1d4ed8)] shadow-[0_0_18px_rgba(56,189,248,0.28)]"
                  : "bg-[linear-gradient(180deg,_#bfdbfe,_#60a5fa_55%,_#2563eb)] shadow-[0_0_18px_rgba(96,165,250,0.3)]"
              }`}
              style={{
                height: `${Math.round(level * 100)}%`,
                opacity: playing ? 0.72 + (index % 4) * 0.06 : 0.25,
                transform: `scaleY(${playing ? 1 : 0.92}) translateY(${playing ? "0px" : "2px"})`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
