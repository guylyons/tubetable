import { useEffect, useMemo, useRef, useState } from "react";
import type { MixChannelState } from "../types";
import {
  BAR_COUNT,
  buildVisualizerProfile,
  calculateVisualizerLevels,
  type BandActivity,
} from "../lib/transportVisualizer";

type TransportVisualizerProps = {
  channelStates: MixChannelState[];
  isDarkMode: boolean;
  transportPlaying: boolean;
};

const FRAME_INTERVAL_MS = 1000 / 34;
const IDLE_BAND_ACTIVITY: BandActivity = { low: 0, mid: 0, high: 0 };

function getBarColor(index: number, isDarkMode: boolean) {
  const position = index / (BAR_COUNT - 1);

  if (position < 0.34) {
    return isDarkMode
      ? "bg-[linear-gradient(180deg,_#e0f2fe,_#38bdf8_42%,_#0369a1)] shadow-[0_0_18px_rgba(14,165,233,0.3)]"
      : "bg-[linear-gradient(180deg,_#bfdbfe,_#60a5fa_55%,_#2563eb)] shadow-[0_0_18px_rgba(96,165,250,0.3)]";
  }

  if (position < 0.68) {
    return isDarkMode
      ? "bg-[linear-gradient(180deg,_#f0fdfa,_#2dd4bf_48%,_#0f766e)] shadow-[0_0_18px_rgba(45,212,191,0.24)]"
      : "bg-[linear-gradient(180deg,_#ccfbf1,_#2dd4bf_55%,_#0d9488)] shadow-[0_0_18px_rgba(20,184,166,0.24)]";
  }

  return isDarkMode
    ? "bg-[linear-gradient(180deg,_#f5f3ff,_#a78bfa_48%,_#6d28d9)] shadow-[0_0_18px_rgba(167,139,250,0.26)]"
    : "bg-[linear-gradient(180deg,_#ede9fe,_#a78bfa_52%,_#7c3aed)] shadow-[0_0_18px_rgba(124,58,237,0.24)]";
}

function getBandPercent(activity: BandActivity, band: keyof BandActivity) {
  return `${Math.round(activity[band] * 100)}%`;
}

export function TransportVisualizer({
  channelStates,
  isDarkMode,
  transportPlaying,
}: TransportVisualizerProps) {
  const profile = useMemo(
    () => buildVisualizerProfile(channelStates, transportPlaying),
    [channelStates, transportPlaying],
  );
  const [visualizerState, setVisualizerState] = useState(() => ({
    bandActivity: IDLE_BAND_ACTIVITY,
    energy: 0,
    levels: Array.from({ length: BAR_COUNT }, () => 0.08),
  }));
  const profileRef = useRef(profile);
  const stateRef = useRef(visualizerState);

  profileRef.current = profile;
  stateRef.current = visualizerState;

  useEffect(() => {
    let animationFrameId = 0;
    let lastFrameAt = 0;

    const animate = (timestamp: number) => {
      if (timestamp - lastFrameAt < FRAME_INTERVAL_MS) {
        animationFrameId = window.requestAnimationFrame(animate);
        return;
      }

      lastFrameAt = timestamp;
      const currentState = stateRef.current;
      const nextState = calculateVisualizerLevels({
        energy: currentState.energy,
        previousLevels: currentState.levels,
        profile: profileRef.current,
        timestamp,
      });

      setVisualizerState(nextState);
      animationFrameId = window.requestAnimationFrame(animate);
    };

    animationFrameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, []);

  const playing = transportPlaying && profile.activeCount > 0;
  const statusLabel = playing ? "Playing" : transportPlaying ? "Add a video" : "Paused";

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
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-sky-300" : "text-slate-500"}`}>
            Visualizer
          </p>
          <p className={`mt-1 text-[11px] leading-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            Shows activity from the videos currently playing
          </p>
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
          {statusLabel}
        </span>
      </div>

      <div className={`relative mt-3 h-32 overflow-hidden rounded-[22px] border px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${isDarkMode ? "border-slate-700 bg-slate-950" : "border-white/70 bg-slate-950"}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.3),_transparent_46%),linear-gradient(180deg,_rgba(15,23,42,0.7),_rgba(2,6,23,0.96))]" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
        <div className="absolute inset-y-3 left-1/3 w-px bg-white/10" />
        <div className="absolute inset-y-3 left-2/3 w-px bg-white/10" />

        <div className="relative flex h-full items-end gap-[3px]">
          {visualizerState.levels.map((level, index) => (
            <span
              key={index}
              className={`block flex-1 rounded-full transition-[height,opacity,transform] duration-100 ease-out ${getBarColor(index, isDarkMode)}`}
              style={{
                height: `${Math.round(level * 100)}%`,
                opacity: playing ? 0.68 + (index % 5) * 0.05 : 0.28,
                transform: `scaleY(${playing ? 1 : 0.9}) translateY(${playing ? "0px" : "3px"})`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-3 gap-2">
        {(["low", "mid", "high"] as const).map((band) => (
          <div key={band}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {band}
              </span>
              <span className={`text-[10px] tabular-nums ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                {getBandPercent(visualizerState.bandActivity, band)}
              </span>
            </div>
            <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}>
              <div
                className={
                  band === "low"
                    ? "h-full rounded-full bg-sky-400 transition-[width] duration-100"
                    : band === "mid"
                      ? "h-full rounded-full bg-teal-400 transition-[width] duration-100"
                      : "h-full rounded-full bg-violet-400 transition-[width] duration-100"
                }
                style={{ width: getBandPercent(visualizerState.bandActivity, band) }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
