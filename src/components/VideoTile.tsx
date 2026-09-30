import { useEffect, useRef, useState } from "react";
import { getStripStatus } from "../lib/mixChannels";
import type { MixChannelState } from "../types";
import {
  applyPlayerVolume,
  createYouTubePlayerVars,
  formatPlaybackTime,
  loadIframeApi,
  syncPlayerPlayback,
  YT_PLAYER_STATE_ENDED,
  YT_PLAYER_STATE_PAUSED,
  type YouTubePlayer,
} from "../lib/youtube";
import { toggleButtonClassName } from "./ui";

type VideoTileProps = {
  channel: MixChannelState;
  isDragging: boolean;
  isDragTarget: boolean;
  isFocused: boolean;
  onChangeVolume: (id: string, volume: number) => void;
  onDragEnd: () => void;
  onDragStart: () => void;
  onFocus: (id: string) => void;
  trackLabel: string;
  onRemove: (id: string) => void;
  onToggleLoop: (id: string) => void;
  onToggleMute: (id: string) => void;
  onTogglePause: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onProgress: (mixKey: string, id: string, progressSeconds: number) => void;
  mixKey: string;
  presentation?: "default" | "focus";
  restartToken: number;
  transportPlaying: boolean;
};

const overlayButtonClassName =
  "border-slate-200 bg-white/95 text-slate-700 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:border-sky-400 dark:hover:text-sky-200";

function readPlayerTimes(player: YouTubePlayer | null) {
  const currentTime = player?.getCurrentTime?.();
  const duration = player?.getDuration?.();

  return {
    currentTime: typeof currentTime === "number" && Number.isFinite(currentTime) ? Math.max(0, currentTime) : null,
    duration: typeof duration === "number" && Number.isFinite(duration) && duration > 0 ? duration : null,
  };
}

export function VideoTile({
  channel,
  isDragging,
  isDragTarget,
  isFocused,
  onChangeVolume,
  onDragEnd,
  onDragStart,
  onFocus,
  trackLabel,
  onRemove,
  onToggleLoop,
  onToggleMute,
  onTogglePause,
  onToggleSolo,
  onProgress,
  mixKey,
  presentation = "default",
  restartToken,
  transportPlaying,
}: VideoTileProps) {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const onProgressRef = useRef(onProgress);
  const handledRestartTokenRef = useRef(restartToken);
  const playbackStateRef = useRef({
    looped: channel.looped,
    paused: channel.paused,
    transportPlaying,
  });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const { effectiveVolume } = channel;
  const { silencedBy, levelLabel } = getStripStatus(channel);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    playbackStateRef.current = {
      looped: channel.looped,
      paused: channel.paused,
      transportPlaying,
    };
  }, [channel.looped, channel.paused, transportPlaying]);

  // Reports under the mix key the player was created for, so a player torn down
  // by a mix switch does not write its position into the next mix.
  function createProgressReporter(targetMixKey: string) {
    return () => {
      const { currentTime, duration } = readPlayerTimes(playerRef.current);
      if (currentTime !== null) {
        onProgressRef.current(targetMixKey, channel.id, currentTime);
      }
      if (duration !== null) {
        setDurationSeconds(duration);
      }
    };
  }

  useEffect(() => {
    let disposed = false;
    const reportProgress = createProgressReporter(mixKey);
    setReady(false);
    setLoadError(null);

    loadIframeApi()
      .then(YT => {
        if (disposed || !playerContainerRef.current) {
          return;
        }

        playerRef.current = new YT.Player(playerContainerRef.current, {
          width: "100%",
          height: "100%",
          videoId: channel.video.videoId,
          // `start` resumes the saved position. Seeking here instead would start a cued video.
          playerVars: {
            ...createYouTubePlayerVars(channel.progressSeconds),
            origin: window.location.origin,
          },
          events: {
            onReady: event => {
              if (disposed) {
                return;
              }

              setReady(true);
              setLoadError(null);
              applyPlayerVolume(event.target, effectiveVolume);
              syncPlayerPlayback(event.target, transportPlaying && !channel.paused);
              reportProgress();
            },
            onStateChange: event => {
              const playbackState = playbackStateRef.current;

              if (
                event.data === YT_PLAYER_STATE_ENDED &&
                playbackState.looped &&
                playbackState.transportPlaying &&
                !playbackState.paused
              ) {
                try {
                  event.target.seekTo(0, true);
                  event.target.playVideo();
                } catch {
                  // The YouTube iframe can briefly reject restart commands during state transitions.
                }
              }

              if (event.data === YT_PLAYER_STATE_PAUSED || event.data === YT_PLAYER_STATE_ENDED) {
                reportProgress();
              }
            },
          },
        });
      })
      .catch(error => {
        if (!disposed) {
          setLoadError(error instanceof Error ? error.message : "Failed to load the YouTube player.");
        }
      });

    return () => {
      disposed = true;
      reportProgress();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [channel.id, channel.video.videoId, mixKey]);

  useEffect(() => {
    if (!ready || !playerRef.current) {
      return;
    }

    applyPlayerVolume(playerRef.current, effectiveVolume);
  }, [effectiveVolume, ready]);

  useEffect(() => {
    if (!ready || !playerRef.current) {
      return;
    }

    syncPlayerPlayback(playerRef.current, transportPlaying && !channel.paused);
  }, [channel.paused, ready, transportPlaying]);

  useEffect(() => {
    if (!ready || !playerRef.current || handledRestartTokenRef.current === restartToken) {
      return;
    }

    handledRestartTokenRef.current = restartToken;
    try {
      playerRef.current.seekTo(0, true);
      syncPlayerPlayback(playerRef.current, transportPlaying && !channel.paused);
    } catch {
      // A restart can land while the iframe is still buffering.
    }
  }, [ready, restartToken]);

  useEffect(() => {
    if (!ready || !playerRef.current || !transportPlaying || channel.paused) {
      return undefined;
    }

    const reportProgress = createProgressReporter(mixKey);
    reportProgress();
    const intervalId = window.setInterval(reportProgress, 1000);

    return () => {
      window.clearInterval(intervalId);
      reportProgress();
    };
  }, [channel.id, channel.paused, mixKey, ready, transportPlaying]);

  const isFocusPresentation = presentation === "focus";
  const progressPercent = durationSeconds > 0 ? Math.min(100, (channel.progressSeconds / durationSeconds) * 100) : 0;

  function seekTo(seconds: number) {
    if (!playerRef.current) {
      return;
    }

    try {
      playerRef.current.seekTo(seconds, true);
      onProgressRef.current(mixKey, channel.id, seconds);
    } catch {
      // The YouTube iframe can briefly reject seek commands during state transitions.
    }
  }

  return (
    <article
      className={`group relative overflow-hidden rounded-3xl border bg-white text-slate-900 shadow-sm transition dark:text-slate-100 ${
        isDragTarget
          ? "border-blue-300 ring-2 ring-blue-100 dark:border-sky-400/40 dark:bg-slate-950 dark:ring-sky-400/20"
          : isFocused
            ? "border-blue-200 dark:border-sky-400/30 dark:bg-slate-950"
            : "border-slate-200 dark:border-slate-800 dark:bg-slate-900"
      } ${isDragging ? "scale-[0.98] opacity-70" : ""}`}
    >
      <div
        className={`group/video relative overflow-hidden bg-slate-100 dark:bg-slate-950 ${
          isFocusPresentation ? "aspect-video md:aspect-[21/9]" : "aspect-video"
        }`}
      >
        {/* The tile's own controls drive playback, so the iframe's buttons stay out of reach. */}
        <div inert className="h-full w-full">
          <div ref={playerContainerRef} />
        </div>
        <button
          type="button"
          draggable
          onDragEnd={onDragEnd}
          onDragStart={event => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", channel.id);
            onDragStart();
          }}
          className={`absolute left-3 top-3 z-20 inline-flex cursor-grab items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] shadow-sm transition active:cursor-grabbing ${overlayButtonClassName}`}
          aria-label={`Drag ${trackLabel} to reorder`}
          title="Drag to reorder"
        >
          <span aria-hidden="true">::</span>
          {trackLabel}
        </button>
        <button
          type="button"
          onClick={() => onRemove(channel.id)}
          className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/95 text-lg font-semibold text-slate-700 shadow-sm transition-opacity duration-150 group-hover/video:pointer-events-auto group-hover/video:opacity-100 group-focus-within/video:pointer-events-auto group-focus-within/video:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100 pointer-events-none opacity-0 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:border-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
          aria-label={`Remove ${channel.video.title} from mix`}
          title="Remove from mix"
        >
          ×
        </button>
        <button
          type="button"
          onClick={() => onFocus(channel.id)}
          className={`absolute top-3 right-16 z-20 inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] shadow-sm transition-opacity duration-150 group-hover/video:pointer-events-auto group-hover/video:opacity-100 group-focus-within/video:pointer-events-auto group-focus-within/video:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100 ${
            isFocused
              ? "border-blue-200 bg-blue-600 text-white hover:bg-blue-700 dark:border-sky-400/40 dark:bg-sky-500 dark:hover:bg-sky-400"
              : overlayButtonClassName
          } ${isFocused ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
          aria-pressed={isFocused}
        >
          {isFocused ? "Exit focus" : "Focus"}
        </button>
        {!ready && !loadError ? (
          <div className="absolute inset-0 grid place-items-center bg-white/90 text-sm text-slate-500 dark:bg-slate-950/90 dark:text-slate-300">
            Buffering…
          </div>
        ) : null}
        {loadError ? (
          <div className="absolute inset-0 grid place-items-center bg-white/95 px-6 text-center text-sm text-red-600 dark:bg-slate-950/95 dark:text-red-300">
            {loadError}
          </div>
        ) : null}
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(durationSeconds))}
          step={1}
          value={Math.floor(channel.progressSeconds)}
          disabled={!ready || durationSeconds <= 0}
          onChange={event => seekTo(Number(event.target.value))}
          className="peer absolute inset-x-0 bottom-0 z-30 h-8 w-full cursor-pointer opacity-0 disabled:pointer-events-none"
          aria-label={`Seek ${channel.video.title}`}
          aria-valuetext={`${formatPlaybackTime(channel.progressSeconds)} of ${formatPlaybackTime(durationSeconds)}`}
        />
        <div
          className="absolute inset-x-0 bottom-0 z-10 h-1.5 bg-slate-200/80 transition-[height] peer-hover:h-2.5 peer-focus-visible:h-2.5 dark:bg-slate-800/80"
          aria-hidden="true"
        >
          <div
            className="h-full bg-blue-600 transition-[width] duration-300 dark:bg-sky-400"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className={`space-y-3 ${isFocusPresentation ? "p-5" : "p-4"}`}>
        <div className="space-y-1">
          <p className={`line-clamp-2 font-semibold ${isFocusPresentation ? "text-xl" : "text-base"}`}>
            {channel.video.title}
          </p>
          <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{channel.video.channelTitle}</span>
            {channel.video.durationText ? <span>{channel.video.durationText}</span> : null}
            {channel.video.viewCountText ? <span>{channel.video.viewCountText}</span> : null}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={channel.volume}
            onChange={event => onChangeVolume(channel.id, Number(event.target.value))}
            className={`tubetable-slider h-2 min-w-0 flex-1 cursor-pointer appearance-none transition-opacity ${silencedBy ? "opacity-45" : ""}`}
            aria-label={`${trackLabel} volume`}
          />
          <span
            className={`w-24 shrink-0 rounded-full px-2 py-1 text-center text-xs font-semibold tabular-nums ${
              silencedBy
                ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                : "bg-blue-50 text-blue-700 dark:bg-sky-500/10 dark:text-sky-200"
            }`}
          >
            {levelLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onTogglePause(channel.id)}
            aria-pressed={channel.paused}
            className={toggleButtonClassName(channel.paused)}
          >
            {channel.paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => onToggleMute(channel.id)}
            aria-pressed={channel.muted}
            className={toggleButtonClassName(channel.muted)}
          >
            {channel.muted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={() => onToggleSolo(channel.id)}
            aria-pressed={channel.solo}
            className={toggleButtonClassName(channel.solo)}
          >
            {channel.solo ? "Unsolo" : "Solo"}
          </button>
          <button
            type="button"
            onClick={() => onToggleLoop(channel.id)}
            aria-pressed={channel.looped}
            className={toggleButtonClassName(channel.looped)}
          >
            {channel.looped ? "Loop on" : "Loop"}
          </button>
        </div>
      </div>
    </article>
  );
}
