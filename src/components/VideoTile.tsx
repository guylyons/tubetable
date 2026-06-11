import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { MixChannel } from "../types";
import {
  applyPlayerVolume,
  createYouTubePlayerVars,
  getSeekSecondsFromPointerPosition,
  loadIframeApi,
  lockPlayerInteraction,
  syncPlayerPlayback,
  YT_PLAYER_STATE_ENDED,
  YT_PLAYER_STATE_PAUSED,
  type YouTubePlayer,
} from "../lib/youtube";

type VideoTileProps = {
  isDarkMode?: boolean;
  channel: MixChannel;
  effectiveVolume: number;
  isDragging: boolean;
  isDragTarget: boolean;
  isFocused: boolean;
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

export function VideoTile({
  isDarkMode = false,
  channel,
  effectiveVolume,
  isDragging,
  isDragTarget,
  isFocused,
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
  const playbackStateRef = useRef({
    looped: channel.looped,
    paused: channel.paused,
    transportPlaying,
  });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);

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

  useEffect(() => {
    let disposed = false;
    setReady(false);
    setLoadError(null);

    loadIframeApi()
      .then((YT) => {
        if (disposed || !playerContainerRef.current) {
          return;
        }

        const captureProgress = () => {
          const currentTime = playerRef.current?.getCurrentTime?.();
          if (typeof currentTime === "number" && Number.isFinite(currentTime)) {
            onProgressRef.current(mixKey, channel.id, Math.max(0, currentTime));
          }

          const duration = playerRef.current?.getDuration?.();
          if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
            setDurationSeconds(duration);
          }
        };

        playerRef.current = new YT.Player(playerContainerRef.current, {
          width: "100%",
          height: "100%",
          videoId: channel.video.videoId,
          playerVars: {
            ...createYouTubePlayerVars(channel.progressSeconds),
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (disposed) {
                return;
              }

              setReady(true);
              setLoadError(null);
              if (channel.progressSeconds > 0) {
                try {
                  event.target.seekTo(channel.progressSeconds, true);
                } catch {
                  // The YouTube iframe can briefly reject seek commands during initialization.
                }
              }
              applyPlayerVolume(event.target, effectiveVolume);
              lockPlayerInteraction(event.target);
              syncPlayerPlayback(
                event.target,
                transportPlaying && !channel.paused,
              );
              captureProgress();
            },
            onStateChange: (event) => {
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

              if (
                event.data === YT_PLAYER_STATE_PAUSED ||
                event.data === YT_PLAYER_STATE_ENDED
              ) {
                captureProgress();
              }
            },
          },
        });
      })
      .catch((error) => {
        if (!disposed) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Failed to load the YouTube player.",
          );
        }
      });

    return () => {
      disposed = true;
      const currentTime = playerRef.current?.getCurrentTime?.();
      if (typeof currentTime === "number" && Number.isFinite(currentTime)) {
        onProgressRef.current(mixKey, channel.id, Math.max(0, currentTime));
      }
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
    if (!ready || !playerRef.current) {
      return;
    }

    try {
      playerRef.current.seekTo(channel.progressSeconds, true);
      syncPlayerPlayback(
        playerRef.current,
        transportPlaying && !channel.paused,
      );
    } catch {
      // A restart can land while the iframe is still buffering.
    }
  }, [ready, restartToken]);

  useEffect(() => {
    if (!ready || !playerRef.current) {
      return undefined;
    }

    const shouldTrackProgress = transportPlaying && !channel.paused;
    if (!shouldTrackProgress) {
      return undefined;
    }

    const captureProgress = () => {
      const currentTime = playerRef.current?.getCurrentTime?.();
      if (typeof currentTime === "number" && Number.isFinite(currentTime)) {
        onProgressRef.current(mixKey, channel.id, Math.max(0, currentTime));
      }

      const duration = playerRef.current?.getDuration?.();
      if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
        setDurationSeconds(duration);
      }
    };

    captureProgress();
    const intervalId = window.setInterval(captureProgress, 1000);

    return () => {
      window.clearInterval(intervalId);
      captureProgress();
    };
  }, [channel.id, channel.paused, mixKey, ready, transportPlaying]);

  const isFocusPresentation = presentation === "focus";
  const progressPercent =
    durationSeconds > 0
      ? Math.min(100, (channel.progressSeconds / durationSeconds) * 100)
      : 0;

  function scrubToPointerPosition(event: PointerEvent<HTMLButtonElement>) {
    if (!playerRef.current) {
      return;
    }

    const currentDuration = playerRef.current.getDuration?.() ?? durationSeconds;
    if (currentDuration > 0 && currentDuration !== durationSeconds) {
      setDurationSeconds(currentDuration);
    }

    const progressBounds = event.currentTarget.getBoundingClientRect();
    const nextProgressSeconds = getSeekSecondsFromPointerPosition(
      event.clientX,
      progressBounds.left,
      progressBounds.width,
      currentDuration,
      channel.progressSeconds,
    );

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
      playerRef.current.seekTo(nextProgressSeconds, true);
      onProgressRef.current(mixKey, channel.id, nextProgressSeconds);
    } catch {
      // The YouTube iframe can briefly reject seek commands during state transitions.
    }
  }

  return (
    <article
      className={`group relative overflow-hidden rounded-3xl border shadow-sm transition ${
        isDarkMode
          ? isDragTarget
            ? "border-sky-400/40 bg-slate-950 text-slate-100 ring-2 ring-sky-400/20"
            : isFocused
              ? "border-sky-400/30 bg-slate-950 text-slate-100"
              : "border-slate-800 bg-slate-900 text-slate-100"
          : isDragTarget
            ? "border-blue-300 bg-white ring-2 ring-blue-100"
            : isFocused
              ? "border-blue-200 bg-white"
              : "border-slate-200 bg-white"
      } ${isDragging ? "scale-[0.98] opacity-70" : ""}`}
    >
      <div
        className={`group/video relative overflow-hidden bg-slate-100 ${
          isFocusPresentation ? "aspect-video md:aspect-[21/9]" : "aspect-video"
        }`}
      >
        <div ref={playerContainerRef} className="h-full w-full [&_iframe]:pointer-events-none" />
        <button
          type="button"
          draggable
          onDragEnd={onDragEnd}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", channel.id);
            onDragStart();
          }}
          className={`absolute left-3 top-3 z-20 inline-flex cursor-grab items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] shadow-sm transition hover:text-blue-700 active:cursor-grabbing ${
            isDarkMode
              ? "border-slate-700 bg-slate-900/95 text-slate-300 hover:border-sky-400 hover:text-sky-200"
              : "border-slate-200 bg-white/95 text-slate-600 hover:border-blue-200"
          }`}
          aria-label={`Drag ${trackLabel} to reorder`}
          title="Drag to reorder"
        >
          <span aria-hidden="true">::</span>
          {trackLabel}
        </button>
        <button
          type="button"
          onClick={() => onRemove(channel.id)}
          className={`absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border text-lg font-semibold shadow-sm transition-opacity duration-150 group-hover/video:pointer-events-auto group-hover/video:opacity-100 group-focus-within/video:pointer-events-auto group-focus-within/video:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 pointer-events-none opacity-0 ${
            isDarkMode
              ? "border-slate-700 bg-slate-900/95 text-slate-300 hover:border-red-400 hover:bg-red-500/10 hover:text-red-300"
              : "border-slate-200 bg-white/95 text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          }`}
          aria-label={`Remove ${channel.video.title} from mix`}
          title="Remove from mix"
        >
          ×
        </button>
        <button
          type="button"
          onClick={() => onFocus(channel.id)}
          className={`absolute bottom-3 right-3 z-20 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] shadow-sm transition-opacity duration-150 group-hover/video:pointer-events-auto group-hover/video:opacity-100 group-focus-within/video:pointer-events-auto group-focus-within/video:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 ${
            isFocused
              ? isDarkMode
                ? "border-sky-400/40 bg-sky-500 text-white hover:bg-sky-400"
                : "border-blue-200 bg-blue-600 text-white hover:bg-blue-700"
              : isDarkMode
                ? "border-slate-700 bg-slate-900/95 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                : "border-slate-200 bg-white/95 text-slate-700 hover:border-blue-200 hover:text-blue-700"
          } pointer-events-none opacity-0`}
          aria-pressed={isFocused}
        >
          {isFocused ? "Exit focus" : "Focus"}
        </button>
        {!ready && !loadError ? (
          <div
            className={`absolute inset-0 grid place-items-center text-sm ${isDarkMode ? "bg-slate-950/90 text-slate-300" : "bg-white/90 text-slate-500"}`}
          >
            Buffering…
          </div>
        ) : null}
        {loadError ? (
          <div
            className={`absolute inset-0 grid place-items-center px-6 text-center text-sm ${isDarkMode ? "bg-slate-950/95 text-red-300" : "bg-white/95 text-red-600"}`}
          >
            {loadError}
          </div>
        ) : null}
        <div
          className={`absolute inset-x-0 bottom-0 z-10 h-1.5 ${isDarkMode ? "bg-slate-800/80" : "bg-slate-200/80"}`}
          aria-hidden="true"
        >
          <div
            className={`h-full transition-[width] duration-300 ${isDarkMode ? "bg-sky-400" : "bg-blue-600"}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <button
          type="button"
          disabled={!ready}
          onPointerDown={scrubToPointerPosition}
          onPointerMove={(event) => {
            if (event.buttons === 1) {
              scrubToPointerPosition(event);
            }
          }}
          className="absolute inset-x-0 bottom-0 z-30 h-8 cursor-pointer bg-transparent disabled:pointer-events-none"
          aria-label={`Scrub ${channel.video.title}`}
        />
      </div>

      <div className={`space-y-3 ${isFocusPresentation ? "p-5" : "p-4"}`}>
        <div className="space-y-1">
          <p
            className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}
          >
            {trackLabel}
          </p>
          <p
            className={`line-clamp-2 font-semibold ${isDarkMode ? "text-slate-50" : "text-slate-900"} ${isFocusPresentation ? "text-xl" : "text-base"}`}
          >
            {channel.video.title}
          </p>
          <div
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
          >
            <span>{channel.video.channelTitle}</span>
            {channel.video.durationText ? (
              <span>{channel.video.durationText}</span>
            ) : null}
            {channel.video.viewCountText ? (
              <span>{channel.video.viewCountText}</span>
            ) : null}
            {isFocused ? (
              <span
                className={`rounded-full px-2 py-1 font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "bg-sky-400/15 text-sky-200" : "bg-blue-50 text-blue-700"}`}
              >
                Focus mode
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onTogglePause(channel.id)}
            aria-pressed={channel.paused}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              channel.paused
                ? isDarkMode
                  ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                  : "border-blue-200 bg-blue-50 text-blue-700"
                : isDarkMode
                  ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400 hover:text-sky-200"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            {channel.paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => onToggleMute(channel.id)}
            aria-pressed={channel.muted}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              channel.muted
                ? isDarkMode
                  ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                  : "border-blue-200 bg-blue-50 text-blue-700"
                : isDarkMode
                  ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400 hover:text-sky-200"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            {channel.muted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={() => onToggleSolo(channel.id)}
            aria-pressed={channel.solo}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              channel.solo
                ? isDarkMode
                  ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                  : "border-blue-200 bg-blue-50 text-blue-700"
                : isDarkMode
                  ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400 hover:text-sky-200"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            {channel.solo ? "Unsolo" : "Solo"}
          </button>
          <button
            type="button"
            onClick={() => onToggleLoop(channel.id)}
            aria-pressed={channel.looped}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              channel.looped
                ? isDarkMode
                  ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                  : "border-blue-200 bg-blue-50 text-blue-700"
                : isDarkMode
                  ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400 hover:text-sky-200"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            {channel.looped ? "Loop on" : "Loop"}
          </button>
        </div>
      </div>
    </article>
  );
}
