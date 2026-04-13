import { useEffect, useRef, useState } from "react";
import type { MixChannel } from "../types";
import {
  applyPlayerVolume,
  loadIframeApi,
  syncPlayerPlayback,
  YT_PLAYER_STATE_ENDED,
  type YouTubePlayer,
} from "../lib/youtube";

type VideoTileProps = {
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
  presentation?: "default" | "focus";
  transportPlaying: boolean;
};

export function VideoTile({
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
  presentation = "default",
  transportPlaying,
}: VideoTileProps) {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const playbackStateRef = useRef({
    looped: channel.looped,
    paused: channel.paused,
    transportPlaying,
  });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      .then(YT => {
        if (disposed || !playerContainerRef.current) {
          return;
        }

        playerRef.current = new YT.Player(playerContainerRef.current, {
          width: "100%",
          height: "100%",
          videoId: channel.video.videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            loop: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
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
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [channel.id, channel.video.videoId]);

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

  const isFocusPresentation = presentation === "focus";

  return (
    <article
      className={`group relative overflow-hidden rounded-3xl border bg-white shadow-sm transition ${
        isDragTarget ? "border-blue-300 ring-2 ring-blue-100" : isFocused ? "border-blue-200" : "border-slate-200"
      } ${isDragging ? "scale-[0.98] opacity-70" : ""}`}
    >
      <div
        className={`relative overflow-hidden bg-slate-100 ${
          isFocusPresentation ? "aspect-video md:aspect-[21/9]" : "aspect-video"
        }`}
      >
        <div ref={playerContainerRef} className="h-full w-full" />
        <button
          type="button"
          draggable
          onDragEnd={onDragEnd}
          onDragStart={event => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", channel.id);
            onDragStart();
          }}
          className="absolute left-3 top-3 z-20 inline-flex cursor-grab items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700 active:cursor-grabbing"
          aria-label={`Drag ${trackLabel} to reorder`}
          title="Drag to reorder"
        >
          <span aria-hidden="true">::</span>
          {trackLabel}
        </button>
        <button
          type="button"
          onClick={() => onRemove(channel.id)}
          className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-lg font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          aria-label={`Remove ${channel.video.title} from mix`}
          title="Remove from mix"
        >
          ×
        </button>
        <button
          type="button"
          onClick={() => onFocus(channel.id)}
          className={`absolute bottom-3 right-3 z-20 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] shadow-sm transition ${
            isFocused
              ? "border-blue-200 bg-blue-600 text-white hover:bg-blue-700"
              : "border-slate-200 bg-white/95 text-slate-700 hover:border-blue-200 hover:text-blue-700"
          }`}
          aria-pressed={isFocused}
        >
          {isFocused ? "Exit focus" : "Focus"}
        </button>
        {!ready && !loadError ? (
          <div className="absolute inset-0 grid place-items-center bg-white/90 text-sm text-slate-500">
            Buffering channel...
          </div>
        ) : null}
        {loadError ? (
          <div className="absolute inset-0 grid place-items-center bg-white/95 px-6 text-center text-sm text-red-600">
            {loadError}
          </div>
        ) : null}
      </div>

      <div className={`space-y-4 ${isFocusPresentation ? "p-6" : "p-5"}`}>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{trackLabel}</p>
          <p className={`line-clamp-2 font-semibold text-slate-900 ${isFocusPresentation ? "text-xl" : "text-base"}`}>
            {channel.video.title}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{channel.video.channelTitle}</span>
            {channel.video.durationText ? <span>{channel.video.durationText}</span> : null}
            {channel.video.viewCountText ? <span>{channel.video.viewCountText}</span> : null}
            {isFocused ? (
              <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold uppercase tracking-[0.14em] text-blue-700">
                Theatre
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onTogglePause(channel.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              channel.paused
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            {channel.paused ? "Resume channel" : "Pause channel"}
          </button>
          <button
            type="button"
            onClick={() => onToggleMute(channel.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              channel.muted
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            {channel.muted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={() => onToggleSolo(channel.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              channel.solo
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            {channel.solo ? "Solo on" : "Solo"}
          </button>
          <button
            type="button"
            onClick={() => onToggleLoop(channel.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              channel.looped
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            {channel.looped ? "Loop on" : "Loop off"}
          </button>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Output {effectiveVolume}%</span>
        </div>
      </div>
    </article>
  );
}
