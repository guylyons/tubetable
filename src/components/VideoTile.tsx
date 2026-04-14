import { useEffect, useRef, useState } from "react";
import type { MixChannel } from "../types";
import {
  applyPlayerVolume,
  loadIframeApi,
  syncPlayerPlayback,
  YT_PLAYER_STATE_ENDED,
  YT_PLAYER_STATE_PAUSED,
  type YouTubePlayer,
} from "../lib/youtube";
import { TrackAudioController } from "../lib/trackAudio";

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
  onChangePlaybackRate: (id: string, playbackRate: number) => void;
  onToggleReverb: (id: string) => void;
  onToggleDelay: (id: string) => void;
  onToggleLofi: (id: string) => void;
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
  onChangePlaybackRate,
  onToggleReverb,
  onToggleDelay,
  onToggleLofi,
  onProgress,
  mixKey,
  presentation = "default",
  restartToken,
  transportPlaying,
}: VideoTileProps) {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const audioControllerRef = useRef<TrackAudioController | null>(null);
  const onProgressRef = useRef(onProgress);
  const playbackStateRef = useRef({
    delayEnabled: channel.delayEnabled,
    looped: channel.looped,
    lofiEnabled: channel.lofiEnabled,
    paused: channel.paused,
    reverbEnabled: channel.reverbEnabled,
    transportPlaying,
  });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    playbackStateRef.current = {
      delayEnabled: channel.delayEnabled,
      looped: channel.looped,
      lofiEnabled: channel.lofiEnabled,
      paused: channel.paused,
      reverbEnabled: channel.reverbEnabled,
      transportPlaying,
    };
  }, [channel.delayEnabled, channel.looped, channel.lofiEnabled, channel.paused, channel.reverbEnabled, transportPlaying]);

  useEffect(() => {
    let disposed = false;
    const audioUrl = `/api/youtube/audio?videoId=${encodeURIComponent(channel.video.videoId)}`;
    const controller = new TrackAudioController({
      debugLabel: `${trackLabel} ${channel.video.title}`,
      audioUrl,
      onEnded: () => {
        const playbackState = playbackStateRef.current;

        if (playbackState.looped && playbackState.transportPlaying && !playbackState.paused) {
          try {
            controller.seek(0);
            void controller.play();
            playerRef.current?.seekTo(0, true);
            playerRef.current?.playVideo();
          } catch {
            // Loop restarts can briefly collide with browser playback state.
          }
          return;
        }

        const currentTime = controller.getCurrentTime();
        if (typeof currentTime === "number" && Number.isFinite(currentTime)) {
          onProgressRef.current(mixKey, channel.id, Math.max(0, currentTime));
        }
      },
      onError: error => {
        if (!disposed) {
          setLoadError(error);
        }
      },
    });

    audioControllerRef.current = controller;
    controller.setVolume(effectiveVolume);
    controller.setPlaybackRate(channel.playbackRate);
    controller.setEffects({
      delayEnabled: channel.delayEnabled,
      lofiEnabled: channel.lofiEnabled,
      reverbEnabled: channel.reverbEnabled,
    });
    controller.seek(channel.progressSeconds);

    return () => {
      disposed = true;
      const currentTime = controller.getCurrentTime();
      if (typeof currentTime === "number" && Number.isFinite(currentTime)) {
        onProgressRef.current(mixKey, channel.id, Math.max(0, currentTime));
      }
      controller.destroy();
      if (audioControllerRef.current === controller) {
        audioControllerRef.current = null;
      }
    };
  }, [
    channel.id,
    channel.video.videoId,
    mixKey,
  ]);

  useEffect(() => {
    let disposed = false;
    setReady(false);
    setLoadError(null);

    loadIframeApi()
      .then(YT => {
        if (disposed || !playerContainerRef.current) {
          return;
        }

        const captureProgress = () => {
          const currentTime =
            audioControllerRef.current?.getCurrentTime?.() ?? playerRef.current?.getCurrentTime?.();
          if (typeof currentTime === "number" && Number.isFinite(currentTime)) {
            onProgressRef.current(mixKey, channel.id, Math.max(0, currentTime));
          }
        };

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
            start: Math.floor(Math.max(0, channel.progressSeconds)),
          },
          events: {
            onReady: event => {
              if (disposed) {
                return;
              }

              setReady(true);
              setLoadError(null);
              if (channel.progressSeconds > 0) {
                try {
                  audioControllerRef.current?.seek(channel.progressSeconds);
                  event.target.seekTo(channel.progressSeconds, true);
                } catch {
                  // The YouTube iframe can briefly reject seek commands during initialization.
                }
              }
              applyPlayerVolume(event.target, 0);
              try {
                event.target.setPlaybackRate(channel.playbackRate);
              } catch {
                // Some videos briefly reject playback-rate changes during init.
              }
              syncPlayerPlayback(event.target, transportPlaying && !channel.paused);
              if (transportPlaying && !channel.paused) {
                void audioControllerRef.current?.play();
              }
              audioControllerRef.current?.setVolume(effectiveVolume);
              audioControllerRef.current?.setPlaybackRate(channel.playbackRate);
              audioControllerRef.current?.setEffects({
                delayEnabled: channel.delayEnabled,
                lofiEnabled: channel.lofiEnabled,
                reverbEnabled: channel.reverbEnabled,
              });
              captureProgress();
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
                captureProgress();
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
      const currentTime = playerRef.current?.getCurrentTime?.();
      if (typeof currentTime === "number" && Number.isFinite(currentTime)) {
        onProgressRef.current(mixKey, channel.id, Math.max(0, currentTime));
      }
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [channel.id, channel.video.videoId, mixKey]);

  useEffect(() => {
    audioControllerRef.current?.setVolume(effectiveVolume);
  }, [effectiveVolume, ready]);

  useEffect(() => {
    audioControllerRef.current?.setPlaybackRate(channel.playbackRate);
    if (!ready || !playerRef.current) {
      return;
    }

    try {
      playerRef.current.setPlaybackRate(channel.playbackRate);
    } catch {
      // The iframe may briefly reject playback-rate updates while buffering.
    }
  }, [channel.playbackRate, ready]);

  useEffect(() => {
    audioControllerRef.current?.setEffects({
      delayEnabled: channel.delayEnabled,
      lofiEnabled: channel.lofiEnabled,
      reverbEnabled: channel.reverbEnabled,
    });
  }, [channel.delayEnabled, channel.lofiEnabled, channel.reverbEnabled, ready]);

  useEffect(() => {
    if (!ready || !playerRef.current) {
      return;
    }

    syncPlayerPlayback(playerRef.current, transportPlaying && !channel.paused);
    const audioController = audioControllerRef.current;
    if (audioController) {
      if (transportPlaying && !channel.paused) {
        void audioController.play();
      } else {
        audioController.pause();
      }
    }
  }, [channel.paused, ready, transportPlaying]);

  useEffect(() => {
    if (!ready || !playerRef.current) {
      return;
    }

    try {
      audioControllerRef.current?.seek(channel.progressSeconds);
      playerRef.current.seekTo(channel.progressSeconds, true);
      syncPlayerPlayback(playerRef.current, transportPlaying && !channel.paused);
      if (transportPlaying && !channel.paused) {
        void audioControllerRef.current?.play();
      }
    } catch {
      // A restart can land while the iframe is still buffering.
    }
  }, [channel.paused, ready, restartToken, transportPlaying]);

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
    };

    captureProgress();
    const intervalId = window.setInterval(captureProgress, 1000);

    return () => {
      window.clearInterval(intervalId);
      captureProgress();
    };
  }, [channel.id, channel.paused, mixKey, ready, transportPlaying]);

  const isFocusPresentation = presentation === "focus";

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
          <div className={`absolute inset-0 grid place-items-center text-sm ${isDarkMode ? "bg-slate-950/90 text-slate-300" : "bg-white/90 text-slate-500"}`}>
            Buffering channel...
          </div>
        ) : null}
        {loadError ? (
          <div className={`absolute inset-0 grid place-items-center px-6 text-center text-sm ${isDarkMode ? "bg-slate-950/95 text-red-300" : "bg-white/95 text-red-600"}`}>
            {loadError}
          </div>
        ) : null}
      </div>

      <div className={`space-y-4 ${isFocusPresentation ? "p-6" : "p-5"}`}>
        <div className="space-y-1">
          <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}>{trackLabel}</p>
          <p className={`line-clamp-2 font-semibold ${isDarkMode ? "text-slate-50" : "text-slate-900"} ${isFocusPresentation ? "text-xl" : "text-base"}`}>
            {channel.video.title}
          </p>
          <div className={`flex flex-wrap items-center gap-2 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            <span>{channel.video.channelTitle}</span>
            {channel.video.durationText ? <span>{channel.video.durationText}</span> : null}
            {channel.video.viewCountText ? <span>{channel.video.viewCountText}</span> : null}
            {isFocused ? (
              <span className={`rounded-full px-2 py-1 font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "bg-sky-400/15 text-sky-200" : "bg-blue-50 text-blue-700"}`}>
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
                ? isDarkMode
                  ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                  : "border-blue-200 bg-blue-50 text-blue-700"
                : isDarkMode
                  ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400 hover:text-sky-200"
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
            {channel.solo ? "Solo on" : "Solo"}
          </button>
          <button
            type="button"
            onClick={() => onToggleLoop(channel.id)}
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
            {channel.looped ? "Loop on" : "Loop off"}
          </button>
          <span className={`rounded-full px-3 py-1 text-xs ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>Output {effectiveVolume}%</span>
        </div>

        <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}>
                Speed
              </p>
              <p className={`mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                Slow down or speed up this track.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isDarkMode ? "bg-slate-800 text-slate-200" : "bg-white text-slate-700"}`}>
              {channel.playbackRate.toFixed(2)}x
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>
              0.5x
            </span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.25}
              value={channel.playbackRate}
              onChange={(event) =>
                onChangePlaybackRate(channel.id, Number(event.target.value))
              }
              className="tubetable-slider h-2 w-full cursor-pointer appearance-none"
              aria-label={`${trackLabel} playback speed`}
            />
            <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>
              2x
            </span>
          </div>
        </div>

        <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}>
                Effects
              </p>
              <p className={`mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                Add reverb, delay, or lofi treatment to this track.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isDarkMode ? "bg-slate-800 text-slate-200" : "bg-white text-slate-700"}`}>
              FX
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onToggleReverb(channel.id)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                channel.reverbEnabled
                  ? isDarkMode
                    ? "border-sky-400/40 bg-sky-500/15 text-sky-200"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                  : isDarkMode
                    ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
              }`}
              aria-pressed={channel.reverbEnabled}
            >
              {channel.reverbEnabled ? "Reverb on" : "Reverb"}
            </button>
            <button
              type="button"
              onClick={() => onToggleDelay(channel.id)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                channel.delayEnabled
                  ? isDarkMode
                    ? "border-sky-400/40 bg-sky-500/15 text-sky-200"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                  : isDarkMode
                    ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
              }`}
              aria-pressed={channel.delayEnabled}
            >
              {channel.delayEnabled ? "Delay on" : "Delay"}
            </button>
            <button
              type="button"
              onClick={() => onToggleLofi(channel.id)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                channel.lofiEnabled
                  ? isDarkMode
                    ? "border-sky-400/40 bg-sky-500/15 text-sky-200"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                  : isDarkMode
                    ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
              }`}
              aria-pressed={channel.lofiEnabled}
            >
              {channel.lofiEnabled ? "Lofi on" : "Lofi"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
