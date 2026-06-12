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
  onPatchChannel: (id: string, patch: Partial<MixChannel>) => void;
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
  onPatchChannel,
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
  const audioControllerRef = useRef<TrackAudioController | null>(null);
  const onProgressRef = useRef(onProgress);
  const playbackStateRef = useRef({
    looped: channel.looped,
    paused: channel.paused,
    transportPlaying,
  });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [trackOptionsOpen, setTrackOptionsOpen] = useState(false);

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
    const audioUrl = `/api/youtube/audio?videoId=${encodeURIComponent(channel.video.videoId)}`;
    const controller = new TrackAudioController({
      audioUrl,
      debugLabel: `${trackLabel} ${channel.video.title}`,
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
      onError: (message) => {
        if (!disposed) {
          setLoadError(message);
        }
      },
    });

    audioControllerRef.current = controller;
    controller.setVolume(effectiveVolume);
    controller.setPlaybackRate(channel.playbackRate);
    controller.setEffects({
      delayEnabled: channel.delayEnabled,
      delayFeedback: channel.delayFeedback,
      delayMix: channel.delayMix,
      delayTimeMs: channel.delayTimeMs,
      lofiCutoffHz: channel.lofiCutoffHz,
      lofiEnabled: channel.lofiEnabled,
      lofiMix: channel.lofiMix,
      reverbDecay: channel.reverbDecay,
      reverbEnabled: channel.reverbEnabled,
      reverbMix: channel.reverbMix,
      reverbPreDelayMs: channel.reverbPreDelayMs,
    });
    controller.setPitchShift(channel.pitchShiftEnabled, channel.pitchShiftSemitones);
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
  }, [channel.id, channel.video.videoId, mixKey, trackLabel]);

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
          const currentTime =
            audioControllerRef.current?.getCurrentTime?.() ?? playerRef.current?.getCurrentTime?.();
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
              applyPlayerVolume(event.target, 0);
              try {
                event.target.setPlaybackRate?.(channel.playbackRate);
              } catch {
                // Some embeds briefly reject playback-rate changes during init.
              }
              lockPlayerInteraction(event.target);
              syncPlayerPlayback(
                event.target,
                transportPlaying && !channel.paused,
              );
              if (transportPlaying && !channel.paused) {
                void audioControllerRef.current?.play();
              }
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
      const currentTime =
        audioControllerRef.current?.getCurrentTime?.() ?? playerRef.current?.getCurrentTime?.();
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

    audioControllerRef.current?.setVolume(effectiveVolume);
    applyPlayerVolume(playerRef.current, 0);
  }, [effectiveVolume, ready]);

  useEffect(() => {
    if (!ready || !playerRef.current) {
      return;
    }

    try {
      audioControllerRef.current?.setPlaybackRate(channel.playbackRate);
      playerRef.current.setPlaybackRate?.(channel.playbackRate);
    } catch {
      // The iframe may briefly reject playback-rate updates while buffering.
    }
  }, [channel.playbackRate, ready]);

  useEffect(() => {
    if (!ready || !playerRef.current) {
      return;
    }

    syncPlayerPlayback(playerRef.current, transportPlaying && !channel.paused);
    if (transportPlaying && !channel.paused) {
      void audioControllerRef.current?.play();
    } else {
      audioControllerRef.current?.pause();
    }
  }, [channel.paused, ready, transportPlaying]);

  useEffect(() => {
    audioControllerRef.current?.setEffects({
      delayEnabled: channel.delayEnabled,
      delayFeedback: channel.delayFeedback,
      delayMix: channel.delayMix,
      delayTimeMs: channel.delayTimeMs,
      lofiCutoffHz: channel.lofiCutoffHz,
      lofiEnabled: channel.lofiEnabled,
      lofiMix: channel.lofiMix,
      reverbDecay: channel.reverbDecay,
      reverbEnabled: channel.reverbEnabled,
      reverbMix: channel.reverbMix,
      reverbPreDelayMs: channel.reverbPreDelayMs,
    });
  }, [
    channel.delayEnabled,
    channel.delayFeedback,
    channel.delayMix,
    channel.delayTimeMs,
    channel.lofiCutoffHz,
    channel.lofiEnabled,
    channel.lofiMix,
    channel.reverbDecay,
    channel.reverbEnabled,
    channel.reverbMix,
    channel.reverbPreDelayMs,
  ]);

  useEffect(() => {
    audioControllerRef.current?.setPitchShift(channel.pitchShiftEnabled, channel.pitchShiftSemitones);
  }, [channel.pitchShiftEnabled, channel.pitchShiftSemitones]);

  useEffect(() => {
    if (!ready || !playerRef.current) {
      return;
    }

    try {
      audioControllerRef.current?.seek(channel.progressSeconds);
      playerRef.current.seekTo(channel.progressSeconds, true);
      syncPlayerPlayback(
        playerRef.current,
        transportPlaying && !channel.paused,
      );
      if (transportPlaying && !channel.paused) {
        void audioControllerRef.current?.play();
      }
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
      const currentTime =
        audioControllerRef.current?.getCurrentTime?.() ?? playerRef.current?.getCurrentTime?.();
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

  const effectCardClass = `rounded-2xl border px-4 py-3 ${
    isDarkMode ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50"
  }`;
  const effectTitleClass = `text-xs font-semibold uppercase tracking-[0.16em] ${
    isDarkMode ? "text-sky-300" : "text-blue-700"
  }`;
  const effectCopyClass = `mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`;
  const effectValueClass = isDarkMode ? "text-slate-200" : "text-slate-700";
  const effectLabelClass = `font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`;

  function patchChannel(patch: Partial<MixChannel>) {
    onPatchChannel(channel.id, patch);
  }

  function renderEffectToggle(enabled: boolean, patch: Partial<MixChannel>) {
    return (
      <button
        type="button"
        onClick={() => patchChannel(patch)}
        className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
          enabled
            ? isDarkMode
              ? "border-sky-400/40 bg-sky-500/15 text-sky-200"
              : "border-blue-200 bg-blue-50 text-blue-700"
            : isDarkMode
              ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
              : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
        }`}
        aria-pressed={enabled}
      >
        {enabled ? "On" : "Off"}
      </button>
    );
  }

  function renderEffectSlider({
    label,
    max,
    min,
    patchKey,
    step,
    unit = "",
    value,
  }: {
    label: string;
    max: number;
    min: number;
    patchKey: keyof MixChannel;
    step?: number;
    unit?: string;
    value: number;
  }) {
    return (
      <label className="block">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className={effectLabelClass}>{label}</span>
          <span className={effectValueClass}>{unit === "x" ? `${value.toFixed(2)}x` : `${value}${unit}`}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => patchChannel({ [patchKey]: Number(event.target.value) } as Partial<MixChannel>)}
          className="tubetable-slider h-2 w-full cursor-pointer appearance-none"
          aria-label={`${trackLabel} ${label.toLowerCase()}`}
        />
      </label>
    );
  }

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
      audioControllerRef.current?.seek(nextProgressSeconds);
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
          className={`absolute top-3 right-16 z-20 inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] shadow-sm transition-opacity duration-150 group-hover/video:pointer-events-auto group-hover/video:opacity-100 group-focus-within/video:pointer-events-auto group-focus-within/video:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 ${
            isFocused
              ? isDarkMode
                ? "border-sky-400/40 bg-sky-500 text-white hover:bg-sky-400"
                : "border-blue-200 bg-blue-600 text-white hover:bg-blue-700"
              : isDarkMode
                ? "border-slate-700 bg-slate-900/95 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                : "border-slate-200 bg-white/95 text-slate-700 hover:border-blue-200 hover:text-blue-700"
          } ${isFocused ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
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
          <button
            type="button"
            onClick={() => setTrackOptionsOpen(true)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
              isDarkMode
                ? "border-sky-400/30 bg-sky-500/10 text-sky-200 hover:border-sky-400 hover:bg-sky-500/15"
                : "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100"
            }`}
          >
            Track options
          </button>
        </div>

        {trackOptionsOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setTrackOptionsOpen(false)} />
            <div
              className={`relative flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border shadow-[0_30px_120px_rgba(15,23,42,0.45)] ${
                isDarkMode
                  ? "border-slate-700 bg-slate-950 text-slate-100"
                  : "border-white bg-white text-slate-900"
              }`}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${channel.id}-track-options-title`}
            >
              <div className={`flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-7 ${isDarkMode ? "border-slate-800 bg-slate-950/85" : "border-slate-200 bg-white/95"}`}>
                <div className="space-y-2">
                  <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}>DSP effects</p>
                  <h3 id={`${channel.id}-track-options-title`} className={`text-2xl font-semibold sm:text-3xl ${isDarkMode ? "text-slate-50" : "text-slate-950"}`}>
                    Track options
                  </h3>
                  <p className={`max-w-2xl text-sm leading-6 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                    Dial in tone and timing for {channel.video.title}. Loop-region editing is intentionally not included here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTrackOptionsOpen(false)}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full border text-xl transition ${
                    isDarkMode
                      ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                  }`}
                  aria-label="Close track options"
                >
                  ×
                </button>
              </div>

              <div className={`flex-1 overflow-y-auto p-5 sm:p-7 ${isDarkMode ? "bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_40%)]" : "bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.12),_transparent_40%)]"}`}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className={effectCardClass}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className={effectTitleClass}>Speed</p>
                        <p className={effectCopyClass}>Slow down or speed up this track.</p>
                      </div>
                    </div>
                    {renderEffectSlider({ label: "Playback speed", min: 0.5, max: 2, step: 0.25, value: channel.playbackRate, patchKey: "playbackRate", unit: "x" })}
                  </div>

                  <div className={effectCardClass}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className={effectTitleClass}>Reverb</p>
                        <p className={effectCopyClass}>Add space, decay, and pre-delay.</p>
                      </div>
                      {renderEffectToggle(channel.reverbEnabled, { reverbEnabled: !channel.reverbEnabled })}
                    </div>
                    <div className="space-y-3">
                      {renderEffectSlider({ label: "Mix", min: 0, max: 100, value: channel.reverbMix, patchKey: "reverbMix", unit: "%" })}
                      {renderEffectSlider({ label: "Decay", min: 0, max: 100, value: channel.reverbDecay, patchKey: "reverbDecay", unit: "%" })}
                      {renderEffectSlider({ label: "Pre-delay", min: 0, max: 200, value: channel.reverbPreDelayMs, patchKey: "reverbPreDelayMs", unit: " ms" })}
                    </div>
                  </div>

                  <div className={effectCardClass}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className={effectTitleClass}>Delay</p>
                        <p className={effectCopyClass}>Tune the repeats and feedback.</p>
                      </div>
                      {renderEffectToggle(channel.delayEnabled, { delayEnabled: !channel.delayEnabled })}
                    </div>
                    <div className="space-y-3">
                      {renderEffectSlider({ label: "Mix", min: 0, max: 100, value: channel.delayMix, patchKey: "delayMix", unit: "%" })}
                      {renderEffectSlider({ label: "Feedback", min: 0, max: 100, value: channel.delayFeedback, patchKey: "delayFeedback", unit: "%" })}
                      {renderEffectSlider({ label: "Time", min: 20, max: 900, step: 10, value: channel.delayTimeMs, patchKey: "delayTimeMs", unit: " ms" })}
                    </div>
                  </div>

                  <div className={effectCardClass}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className={effectTitleClass}>Lofi</p>
                        <p className={effectCopyClass}>Darken and soften the track.</p>
                      </div>
                      {renderEffectToggle(channel.lofiEnabled, { lofiEnabled: !channel.lofiEnabled })}
                    </div>
                    <div className="space-y-3">
                      {renderEffectSlider({ label: "Mix", min: 0, max: 100, value: channel.lofiMix, patchKey: "lofiMix", unit: "%" })}
                      {renderEffectSlider({ label: "Cutoff", min: 300, max: 12000, step: 50, value: channel.lofiCutoffHz, patchKey: "lofiCutoffHz", unit: " Hz" })}
                    </div>
                  </div>

                  <div className={effectCardClass}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className={effectTitleClass}>Pitch</p>
                        <p className={effectCopyClass}>Shift pitch without changing the transport speed.</p>
                      </div>
                      {renderEffectToggle(channel.pitchShiftEnabled, { pitchShiftEnabled: !channel.pitchShiftEnabled })}
                    </div>
                    {renderEffectSlider({ label: "Semitones", min: -12, max: 12, step: 1, value: channel.pitchShiftSemitones, patchKey: "pitchShiftSemitones" })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
