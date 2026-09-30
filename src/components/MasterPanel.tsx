import { FilePlus2, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import type { CSSProperties } from "react";
import { accentButtonClassName, panelClassName, quietButtonClassName } from "./ui";

type MasterPanelProps = {
  anyPlaying: boolean;
  hasChannels: boolean;
  masterVolume: number;
  onChangeMasterVolume: (volume: number) => void;
  onNewMix: () => void;
  onRestart: () => void;
  onToggleMasterMute: () => void;
  onTogglePlayAll: () => void;
};

export function MasterPanel({
  anyPlaying,
  hasChannels,
  masterVolume,
  onChangeMasterVolume,
  onNewMix,
  onRestart,
  onToggleMasterMute,
  onTogglePlayAll,
}: MasterPanelProps) {
  const muted = masterVolume === 0;

  return (
    <section aria-labelledby="master-heading" className={`${panelClassName} p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="master-heading" className="text-lg font-medium uppercase tracking-[0.08em]">
          Master
        </h2>
        <button
          type="button"
          onClick={onToggleMasterMute}
          aria-pressed={muted}
          aria-label={muted ? "Unmute master" : "Mute master"}
          className={`h-9 px-3 tabular-nums ${quietButtonClassName}`}
        >
          {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
          {masterVolume}%
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={masterVolume}
        onChange={event => onChangeMasterVolume(Number(event.target.value))}
        aria-label="Master volume"
        aria-valuetext={`${masterVolume}%`}
        className="tt-range mt-4 w-full"
        style={{ "--range-fill": `${masterVolume}%` } as CSSProperties}
      />

      <div className="mt-4 grid grid-cols-[1.35fr_1fr_1fr] gap-2">
        <button
          type="button"
          onClick={onTogglePlayAll}
          disabled={!hasChannels}
          className={`h-12 px-3 text-base ${accentButtonClassName}`}
        >
          {anyPlaying ? (
            <Pause size={20} fill="currentColor" aria-hidden="true" />
          ) : (
            <Play size={20} fill="currentColor" aria-hidden="true" />
          )}
          {anyPlaying ? "Pause all" : "Play all"}
        </button>
        <button
          type="button"
          onClick={onRestart}
          disabled={!hasChannels}
          className={`h-12 px-2 whitespace-nowrap ${quietButtonClassName}`}
        >
          <RotateCcw size={17} aria-hidden="true" className="hidden shrink-0 sm:block" />
          Restart
        </button>
        <button type="button" onClick={onNewMix} className={`h-12 px-2 whitespace-nowrap ${quietButtonClassName}`}>
          <FilePlus2 size={17} aria-hidden="true" className="hidden shrink-0 sm:block" />
          New mix
        </button>
      </div>
    </section>
  );
}
