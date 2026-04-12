import { useEffect, useRef, useState } from "react";
import type { MixChannel } from "../types";
import { applyPlayerVolume, loadIframeApi, syncPlayerPlayback, type YouTubePlayer } from "../lib/youtube";

type VideoTileProps = {
  channel: MixChannel;
  effectiveVolume: number;
  onRemove: (id: string) => void;
  onToggleMute: (id: string) => void;
  onTogglePause: (id: string) => void;
  transportPlaying: boolean;
};

export function VideoTile({
  channel,
  effectiveVolume,
  onRemove,
  onToggleMute,
  onTogglePause,
  transportPlaying,
}: VideoTileProps) {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
            loop: 1,
            modestbranding: 1,
            playsinline: 1,
            playlist: channel.video.videoId,
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

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-video overflow-hidden bg-slate-100">
        <div ref={playerContainerRef} className="h-full w-full" />
        <button
          type="button"
          onClick={() => onRemove(channel.id)}
          className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-lg font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          aria-label={`Remove ${channel.video.title} from mix`}
          title="Remove from mix"
        >
          ×
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

      <div className="space-y-4 p-5">
        <div className="space-y-1">
          <p className="line-clamp-2 text-base font-semibold text-slate-900">{channel.video.title}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{channel.video.channelTitle}</span>
            {channel.video.durationText ? <span>{channel.video.durationText}</span> : null}
            {channel.video.viewCountText ? <span>{channel.video.viewCountText}</span> : null}
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
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Output {effectiveVolume}%</span>
        </div>
      </div>
    </article>
  );
}
