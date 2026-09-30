import {
  Loader2,
  Maximize2,
  Minimize2,
  Music2,
  Pause,
  Play,
  Search,
  TriangleAlert,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { CSSProperties } from "react";
import { formatPlaybackTime, formatPlaybackTimeLike } from "../lib/youtube";
import type { MixChannelState, PlayerStatus } from "../types";
import { Menu, type MenuItem } from "./Menu";
import { PLAYER_SLOT_ATTRIBUTE } from "./PlayerLayer";
import { accentButtonClassName, quietButtonClassName } from "./ui";

type StageProps = {
  channel: MixChannelState | null;
  channelNumber: string;
  color: string;
  expanded: boolean;
  isPlaying: boolean;
  menuItems: MenuItem[];
  onFocusSearch: () => void;
  onRemove: () => void;
  onSeek: (seconds: number) => void;
  onToggleExpand: () => void;
  onToggleMute: () => void;
  onTogglePlay: () => void;
  status: PlayerStatus | undefined;
};

const stageButtonClassName =
  "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50";

export function Stage({
  channel,
  channelNumber,
  color,
  expanded,
  isPlaying,
  menuItems,
  onFocusSearch,
  onRemove,
  onSeek,
  onToggleExpand,
  onToggleMute,
  onTogglePlay,
  status,
}: StageProps) {
  const boxClassName = expanded
    ? "fixed inset-0 z-[5] bg-black"
    : "relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg";

  if (!channel) {
    return (
      <section aria-label="Stage">
        <div className={`${boxClassName} grid place-items-center border border-line bg-black/25! shadow-none`}>
          <div className="max-w-md px-6 text-center text-fg">
            <Music2 size={40} aria-hidden="true" className="mx-auto text-fg-muted" />
            <h2 className="mt-4 text-2xl font-bold tracking-tight">Start your session</h2>
            <p className="mt-2 text-fg-muted">
              Search YouTube or paste a link. Each video becomes a channel you can play, mute, solo and mix — up to five
              at once.
            </p>
            <button type="button" onClick={onFocusSearch} className={`mt-6 h-11 px-5 ${accentButtonClassName}`}>
              <Search size={18} aria-hidden="true" />
              Search YouTube
            </button>
          </div>
        </div>
      </section>
    );
  }

  const duration = channel.durationSeconds;
  const progress = Math.min(channel.progressSeconds, duration || channel.progressSeconds);
  const fill = duration > 0 ? `${(progress / duration) * 100}%` : "0%";
  const ready = status !== undefined && status !== "loading" && status !== "error";
  const overlayClassName = expanded ? "fixed inset-0 z-50" : "absolute inset-0 z-20";

  return (
    <section aria-label="Stage" className="space-y-3">
      <div className="relative">
        <div
          className={`${boxClassName} bg-cover bg-center`}
          style={{ backgroundImage: `url("${channel.video.thumbnail}")` }}
          {...{ [PLAYER_SLOT_ATTRIBUTE]: channel.id }}
        />

        {/* A sibling of the slot so it stacks above the video layer, including when expanded. */}
        <div className={`pointer-events-none flex flex-col justify-between ${overlayClassName}`}>
          <div className="flex items-start justify-between p-3 sm:p-4">
            <span
              className="rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[#1b1b1c] shadow"
              style={{ backgroundColor: color }}
            >
              {channelNumber} • Focused
            </span>
            {expanded ? (
              <span className="rounded-md bg-black/60 px-2.5 py-1 text-sm font-medium text-white">
                {channel.video.title}
              </span>
            ) : null}
          </div>

          {status === "loading" || status === "buffering" ? (
            <Loader2 size={36} aria-label="Loading video" className="mx-auto animate-spin text-white drop-shadow" />
          ) : null}

          {status === "error" ? (
            <div
              role="alert"
              className="pointer-events-auto mx-auto max-w-sm rounded-xl bg-black/80 p-5 text-center text-white"
            >
              <TriangleAlert size={28} aria-hidden="true" className="mx-auto text-amber-300" />
              <p className="mt-2 font-bold">This video can’t play here</p>
              <p className="mt-1 text-sm text-white/75">YouTube blocks it from being embedded, or it was removed.</p>
              <button type="button" onClick={onRemove} className={`mt-4 h-9 px-4 ${quietButtonClassName}`}>
                Remove channel
              </button>
            </div>
          ) : null}

          <div className="pointer-events-auto flex items-center gap-2 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-2 pb-2 pt-10 text-white sm:gap-3 sm:px-4 sm:pb-3">
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={status === "error"}
              aria-label={isPlaying ? `Pause ${channel.video.title}` : `Play ${channel.video.title}`}
              className={stageButtonClassName}
            >
              {isPlaying ? (
                <Pause size={22} fill="currentColor" aria-hidden="true" />
              ) : (
                <Play size={22} fill="currentColor" aria-hidden="true" />
              )}
            </button>
            <span className="shrink-0 text-sm tabular-nums">
              {duration > 0 ? formatPlaybackTimeLike(progress, duration) : formatPlaybackTime(progress)}
              <span className="text-white/60"> / {duration > 0 ? formatPlaybackTime(duration) : "--:--"}</span>
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(duration))}
              step={1}
              value={Math.floor(progress)}
              disabled={!ready || duration <= 0}
              onChange={event => onSeek(Number(event.target.value))}
              aria-label={`Seek ${channel.video.title}`}
              aria-valuetext={`${formatPlaybackTime(progress)} of ${formatPlaybackTime(duration)}`}
              className="tt-range tt-range-scrub flex-1"
              style={{ "--range-fill": fill, "--range-color": color } as CSSProperties}
            />
            <button
              type="button"
              onClick={onToggleMute}
              aria-pressed={channel.muted}
              aria-label={channel.muted ? `Unmute ${channel.video.title}` : `Mute ${channel.video.title}`}
              className={stageButtonClassName}
            >
              {channel.muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={onToggleExpand}
              aria-pressed={expanded}
              aria-label={expanded ? "Exit full screen" : "Full screen"}
              className={stageButtonClassName}
            >
              {expanded ? <Minimize2 size={20} aria-hidden="true" /> : <Maximize2 size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      <div className={`flex items-start justify-between gap-3 px-1 ${expanded ? "invisible" : ""}`}>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-medium tracking-tight text-fg">{channel.video.title}</h2>
          <p className="truncate text-sm text-fg-muted">by {channel.video.channelTitle}</p>
        </div>
        <Menu
          label={`Channel ${channelNumber} options`}
          items={menuItems}
          buttonClassName="text-fg hover:bg-white/10"
        />
      </div>
    </section>
  );
}
