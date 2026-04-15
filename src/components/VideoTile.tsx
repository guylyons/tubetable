import { useEffect, useRef, useState } from "react";
import type { MixChannel, MixChannelState } from "../types";
import {
  applyPlayerVolume,
  loadIframeApi,
  syncPlayerPlayback,
  YT_PLAYER_STATE_ENDED,
  YT_PLAYER_STATE_PAUSED,
  type YouTubePlayer,
} from "../lib/youtube";
import { TrackAudioController } from "../lib/trackAudio";
import {
  getBeatLengthSeconds,
  getBeatPosition,
  getLoopRegionSeconds,
  getNextActiveStepIndex,
  getStepIndexForSeconds,
  getStepSequencerState,
  STEP_SEQUENCE_LENGTH,
  getSyncedPlaybackRate,
} from "../lib/mixChannels";
import { prefetchWaveformData } from "../lib/waveformData";
import { LoopRegionEditor } from "./LoopRegionEditor";
import { StepSequencer } from "./StepSequencer";

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
  onPatchChannel: (id: string, patch: Partial<MixChannel>) => void;
  onProgress: (mixKey: string, id: string, progressSeconds: number) => void;
  mixKey: string;
  beatSyncTargetSeconds: number | null;
  channelStates: MixChannelState[];
  tapTempoBpm: number | null;
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
  onPatchChannel,
  onProgress,
  mixKey,
  beatSyncTargetSeconds,
  channelStates,
  tapTempoBpm,
  presentation = "default",
  restartToken,
  transportPlaying,
}: VideoTileProps) {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const audioControllerRef = useRef<TrackAudioController | null>(null);
  const lastBeatSyncTargetRef = useRef<number | null>(null);
  const onProgressRef = useRef(onProgress);
  const [expandedEffects, setExpandedEffects] = useState({
    reverb: true,
    delay: true,
    lofi: true,
    pitch: true,
    sync: true,
  });
  const [trackOptionsOpen, setTrackOptionsOpen] = useState(false);
  const [tempoTapHistory, setTempoTapHistory] = useState<number[]>([]);
  const [trackTempoInput, setTrackTempoInput] = useState(
    channel.tempoBpm === null ? "" : String(channel.tempoBpm),
  );
  const [trackDurationSeconds, setTrackDurationSeconds] = useState<
    number | null
  >(null);
  const playbackStateRef = useRef({
    delayEnabled: channel.delayEnabled,
    looped: channel.looped,
    loopEndSeconds: channel.loopEndSeconds,
    loopStartSeconds: channel.loopStartSeconds,
    lofiEnabled: channel.lofiEnabled,
    paused: channel.paused,
    stepPattern: channel.stepPattern,
    stepSequencerEnabled: channel.stepSequencerEnabled,
    reverbEnabled: channel.reverbEnabled,
    transportPlaying,
  });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const audioUrl = `/api/youtube/audio?videoId=${encodeURIComponent(channel.video.videoId)}`;
  const waveformDataUrl = `/api/youtube/waveform-data?videoId=${encodeURIComponent(channel.video.videoId)}`;

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    setTrackDurationSeconds(null);
  }, [channel.video.videoId]);

  useEffect(() => {
    if (!trackOptionsOpen) {
      return;
    }

    prefetchWaveformData(waveformDataUrl);
  }, [trackOptionsOpen, waveformDataUrl]);

  useEffect(() => {
    playbackStateRef.current = {
      delayEnabled: channel.delayEnabled,
      looped: channel.looped,
      loopEndSeconds: channel.loopEndSeconds,
      loopStartSeconds: channel.loopStartSeconds,
      lofiEnabled: channel.lofiEnabled,
      paused: channel.paused,
      stepPattern: channel.stepPattern,
      stepSequencerEnabled: channel.stepSequencerEnabled,
      reverbEnabled: channel.reverbEnabled,
      transportPlaying,
    };
  }, [
    channel.delayEnabled,
    channel.loopEndSeconds,
    channel.loopStartSeconds,
    channel.looped,
    channel.lofiEnabled,
    channel.paused,
    channel.stepPattern,
    channel.stepSequencerEnabled,
    channel.reverbEnabled,
    transportPlaying,
  ]);

  function seekPlayback(nextSeconds: number) {
    const normalizedSeconds = Math.max(0, nextSeconds);
    audioControllerRef.current?.seek(normalizedSeconds);
    if (playerRef.current) {
      try {
        playerRef.current.seekTo(normalizedSeconds, true);
      } catch {
        // The iframe can briefly reject seeks while buffering.
      }
    }
    onProgressRef.current(mixKey, channel.id, normalizedSeconds);
  }

  function restartPlaybackAt(nextSeconds: number) {
    seekPlayback(nextSeconds);
    const playbackState = playbackStateRef.current;
    if (playbackState.transportPlaying && !playbackState.paused) {
      if (playerRef.current) {
        syncPlayerPlayback(playerRef.current, true);
      }
      void audioControllerRef.current?.play();
    }
  }

  function updateLoopStart(nextLoopStartSeconds: number) {
    const normalizedStart = Math.max(0, nextLoopStartSeconds);
    const currentEnd = channel.loopEndSeconds;
    onPatchChannel(channel.id, {
      loopStartSeconds: normalizedStart,
      loopEndSeconds:
        typeof currentEnd === "number" &&
        Number.isFinite(currentEnd) &&
        currentEnd <= normalizedStart
          ? normalizedStart + 0.01
          : currentEnd,
    });
  }

  function updateLoopEnd(nextLoopEndSeconds: number) {
    const normalizedEnd = Math.max(0, nextLoopEndSeconds);
    const currentStart = channel.loopStartSeconds;
    onPatchChannel(channel.id, {
      loopStartSeconds:
        typeof currentStart === "number" &&
        Number.isFinite(currentStart) &&
        currentStart >= normalizedEnd
          ? Math.max(0, normalizedEnd - 0.01)
          : currentStart,
      loopEndSeconds: normalizedEnd,
    });
  }

  function clearLoopRegion() {
    onPatchChannel(channel.id, {
      loopStartSeconds: null,
      loopEndSeconds: null,
    });
  }

  useEffect(() => {
    let disposed = false;
    const controller = new TrackAudioController({
      debugLabel: `${trackLabel} ${channel.video.title}`,
      audioUrl,
      onMetadata: (durationSeconds) => {
        setTrackDurationSeconds(durationSeconds);
      },
      onTimeUpdate: (currentTimeSeconds) => {
        const playbackState = playbackStateRef.current;
        const loopRegion = getLoopRegionSeconds(playbackState);
        const stepSequencerState = getStepSequencerState(playbackState);

        if (
          loopRegion &&
          stepSequencerState &&
          playbackState.looped &&
          playbackState.transportPlaying &&
          !playbackState.paused
        ) {
          const stepIndex = getStepIndexForSeconds({
            currentSeconds: currentTimeSeconds,
            loopEndSeconds: loopRegion.loopEndSeconds,
            loopStartSeconds: loopRegion.loopStartSeconds,
          });

          if (stepIndex !== null) {
            const loopDuration =
              loopRegion.loopEndSeconds - loopRegion.loopStartSeconds;
            const stepLengthSeconds = loopDuration / STEP_SEQUENCE_LENGTH;
            const currentStepStart =
              loopRegion.loopStartSeconds + stepIndex * stepLengthSeconds;
            const currentStepEnd = currentStepStart + stepLengthSeconds;
            const currentStepActive =
              stepSequencerState.pattern[stepIndex] ?? false;

            if (!currentStepActive) {
              const nextIndex = getNextActiveStepIndex(
                stepSequencerState.pattern,
                stepIndex,
              );
              if (nextIndex !== null) {
                restartPlaybackAt(
                  loopRegion.loopStartSeconds + nextIndex * stepLengthSeconds,
                );
                return;
              }
            }

            if (currentStepActive && currentTimeSeconds >= currentStepEnd - 0.03) {
              const nextIndex = getNextActiveStepIndex(
                stepSequencerState.pattern,
                stepIndex,
              );
              if (nextIndex !== null) {
                restartPlaybackAt(
                  loopRegion.loopStartSeconds + nextIndex * stepLengthSeconds,
                );
                return;
              }
            }
          }
        }

        if (
          loopRegion &&
          playbackState.looped &&
          playbackState.transportPlaying &&
          !playbackState.paused &&
          currentTimeSeconds >= loopRegion.loopEndSeconds - 0.03
        ) {
          restartPlaybackAt(loopRegion.loopStartSeconds);
          return;
        }

        onProgressRef.current(
          mixKey,
          channel.id,
          Math.max(0, currentTimeSeconds),
        );
      },
      onEnded: () => {
        const playbackState = playbackStateRef.current;
        const loopRegion = getLoopRegionSeconds(playbackState);

        if (
          playbackState.looped &&
          playbackState.transportPlaying &&
          !playbackState.paused
        ) {
          try {
            restartPlaybackAt(loopRegion?.loopStartSeconds ?? 0);
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
      onError: (error) => {
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
    controller.setPitchShift(
      channel.pitchShiftEnabled,
      channel.pitchShiftSemitones,
    );
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
  }, [channel.id, channel.video.videoId, mixKey]);

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
            audioControllerRef.current?.getCurrentTime?.() ??
            playerRef.current?.getCurrentTime?.();
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
            onReady: (event) => {
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
              syncPlayerPlayback(
                event.target,
                transportPlaying && !channel.paused,
              );
              if (transportPlaying && !channel.paused) {
                void audioControllerRef.current?.play();
              }
              audioControllerRef.current?.setVolume(effectiveVolume);
              audioControllerRef.current?.setPlaybackRate(channel.playbackRate);
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
              audioControllerRef.current?.setPitchShift(
                channel.pitchShiftEnabled,
                channel.pitchShiftSemitones,
              );
              captureProgress();
            },
            onStateChange: (event) => {
              const playbackState = playbackStateRef.current;
              const loopRegion = getLoopRegionSeconds(playbackState);

              if (
                event.data === YT_PLAYER_STATE_ENDED &&
                playbackState.looped &&
                playbackState.transportPlaying &&
                !playbackState.paused
              ) {
                try {
                  restartPlaybackAt(loopRegion?.loopStartSeconds ?? 0);
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
    ready,
  ]);

  useEffect(() => {
    audioControllerRef.current?.setPitchShift(
      channel.pitchShiftEnabled,
      channel.pitchShiftSemitones,
    );
    if (!ready || !playerRef.current) {
      return;
    }

    try {
      playerRef.current.seekTo(channel.progressSeconds, true);
    } catch {
      // Pitch reloads can briefly race with the player state.
    }
  }, [channel.pitchShiftEnabled, channel.pitchShiftSemitones, ready]);

  const trackTempoBpm = channel.tempoBpm;

  useEffect(() => {
    setTrackTempoInput(trackTempoBpm === null ? "" : String(trackTempoBpm));
  }, [trackTempoBpm]);
  const selectedBeatSyncSourceChannel =
    channelStates.find(
      (other) => other.id === channel.beatSyncSourceChannelId,
    ) ?? null;
  const beatSyncSourceChannel =
    selectedBeatSyncSourceChannel ??
    channelStates.find((other) => other.id !== channel.id) ??
    null;
  const syncReferenceTempoBpm =
    beatSyncSourceChannel?.tempoBpm ?? tapTempoBpm ?? 120;
  const beatSyncSourceTempoBpm =
    beatSyncSourceChannel?.tempoBpm ?? syncReferenceTempoBpm;
  const trackTempoLabel = trackTempoBpm
    ? `${trackTempoBpm} BPM`
    : "Tap twice to learn BPM";
  const activeLoopRegion = getLoopRegionSeconds(channel);
  const currentStepIndex =
    activeLoopRegion && channel.stepSequencerEnabled
      ? getStepIndexForSeconds({
          currentSeconds: channel.progressSeconds,
          loopEndSeconds: activeLoopRegion.loopEndSeconds,
          loopStartSeconds: activeLoopRegion.loopStartSeconds,
        })
      : null;
  const loopToggleLabel = channel.looped
    ? activeLoopRegion
      ? "Loop A/B on"
      : "Loop on"
    : "Loop off";
  const syncLockLabel = channel.beatSyncSourceChannelId
    ? selectedBeatSyncSourceChannel
      ? `Locked to ${selectedBeatSyncSourceChannel.video.title}`
      : "Reference missing"
    : tapTempoBpm
      ? `Grid ${tapTempoBpm} BPM`
      : "Grid 120 BPM";

  function handleTrackTapTempo() {
    const now = performance.now();
    const maxGapMs = 2500;
    setTempoTapHistory((previousHistory) => {
      const filteredHistory =
        previousHistory.length === 0 ||
        now - previousHistory[previousHistory.length - 1]! > maxGapMs
          ? [now]
          : [...previousHistory.slice(-5), now];

      if (filteredHistory.length < 2) {
        onPatchChannel(channel.id, {
          tempoBpm: null,
        });
        return filteredHistory;
      }

      const intervals = filteredHistory
        .slice(1)
        .map((tap, index) => tap - filteredHistory[index]!);
      const sortedIntervals = [...intervals].sort(
        (left, right) => left - right,
      );
      const trimmedIntervals =
        sortedIntervals.length > 3
          ? sortedIntervals.slice(1, -1)
          : sortedIntervals;
      const averageInterval =
        trimmedIntervals.reduce((total, interval) => total + interval, 0) /
        trimmedIntervals.length;
      const rawTempoBpm = 60000 / averageInterval;
      const nextTempoBpm = Math.min(240, Math.max(40, Math.round(rawTempoBpm)));

      onPatchChannel(channel.id, {
        tempoBpm: nextTempoBpm,
        playbackRate: getSyncedPlaybackRate(
          syncReferenceTempoBpm,
          nextTempoBpm,
        ),
      });

      return filteredHistory;
    });
  }

  function applyTrackTempo(nextTempoBpm: number | null) {
    setTempoTapHistory([]);

    if (nextTempoBpm === null) {
      onPatchChannel(channel.id, { tempoBpm: null });
      return;
    }

    onPatchChannel(channel.id, {
      tempoBpm: nextTempoBpm,
      playbackRate: getSyncedPlaybackRate(syncReferenceTempoBpm, nextTempoBpm),
    });
  }

  function commitTrackTempoInput() {
    const trimmedValue = trackTempoInput.trim();
    if (trimmedValue === "") {
      applyTrackTempo(null);
      return;
    }

    const nextValue = Number(trimmedValue);
    if (!Number.isFinite(nextValue)) {
      setTrackTempoInput(trackTempoBpm === null ? "" : String(trackTempoBpm));
      return;
    }

    applyTrackTempo(Math.min(240, Math.max(40, Math.round(nextValue))));
  }

  function adjustTrackTempo(multiplier: number) {
    if (!trackTempoBpm) {
      return;
    }

    const nextTempoBpm = Math.min(
      240,
      Math.max(40, Math.round(trackTempoBpm * multiplier)),
    );

    onPatchChannel(channel.id, {
      tempoBpm: nextTempoBpm,
      playbackRate: getSyncedPlaybackRate(
        syncReferenceTempoBpm,
        nextTempoBpm,
      ),
    });
  }

  function handleSyncNow() {
    const sourceProgressSeconds =
      beatSyncSourceChannel?.progressSeconds ?? channel.progressSeconds;
    const sourceTempoBpm = beatSyncSourceTempoBpm;
    const targetTempoBpm = trackTempoBpm ?? sourceTempoBpm;
    const sourceBeatPosition = getBeatPosition(
      sourceProgressSeconds,
      sourceTempoBpm,
    );

    if (sourceBeatPosition === null) {
      return;
    }

    const nextBeatPosition = Math.max(0, Math.round(sourceBeatPosition));
    const beatLengthSeconds = getBeatLengthSeconds(targetTempoBpm);
    if (beatLengthSeconds === null) {
      return;
    }

    const nextProgressSeconds = nextBeatPosition * beatLengthSeconds;
    const nextBeatOffset = nextBeatPosition - sourceBeatPosition;

    onPatchChannel(channel.id, {
      beatSyncOffsetBeats: nextBeatOffset,
      beatSyncSourceChannelId:
        beatSyncSourceChannel?.id ?? channel.beatSyncSourceChannelId,
      playbackRate: getSyncedPlaybackRate(sourceTempoBpm, targetTempoBpm),
      tempoBpm: trackTempoBpm,
    });

    audioControllerRef.current?.seek(nextProgressSeconds);
    if (playerRef.current) {
      try {
        playerRef.current.seekTo(nextProgressSeconds, true);
      } catch {
        // The iframe can briefly reject seeks while buffering.
      }
    }
    onProgressRef.current(mixKey, channel.id, Math.max(0, nextProgressSeconds));
    lastBeatSyncTargetRef.current = nextProgressSeconds;
  }

  useEffect(() => {
    if (!trackOptionsOpen) {
      return undefined;
    }

    setExpandedEffects({
      reverb: true,
      delay: true,
      lofi: true,
      pitch: true,
      sync: true,
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTrackOptionsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [trackOptionsOpen]);

  useEffect(() => {
    if (!ready || !playerRef.current || beatSyncTargetSeconds === null) {
      return;
    }

    if (
      lastBeatSyncTargetRef.current !== null &&
      Math.abs(lastBeatSyncTargetRef.current - beatSyncTargetSeconds) < 0.05
    ) {
      return;
    }

    const currentTime =
      audioControllerRef.current?.getCurrentTime?.() ??
      playerRef.current.getCurrentTime?.() ??
      0;
    if (Math.abs(currentTime - beatSyncTargetSeconds) < 0.1) {
      lastBeatSyncTargetRef.current = beatSyncTargetSeconds;
      return;
    }

    try {
      audioControllerRef.current?.seek(beatSyncTargetSeconds);
      playerRef.current.seekTo(beatSyncTargetSeconds, true);
      if (transportPlaying && !channel.paused) {
        syncPlayerPlayback(playerRef.current, true);
        void audioControllerRef.current?.play();
      }
      onProgressRef.current(
        mixKey,
        channel.id,
        Math.max(0, beatSyncTargetSeconds),
      );
      lastBeatSyncTargetRef.current = beatSyncTargetSeconds;
    } catch {
      // Beat corrections can briefly race with buffering or player state.
    }
  }, [
    beatSyncTargetSeconds,
    channel.id,
    channel.paused,
    mixKey,
    ready,
    transportPlaying,
  ]);

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
            Buffering channel...
          </div>
        ) : null}
        {loadError ? (
          <div
            className={`absolute inset-0 grid place-items-center px-6 text-center text-sm ${isDarkMode ? "bg-slate-950/95 text-red-300" : "bg-white/95 text-red-600"}`}
          >
            {loadError}
          </div>
        ) : null}
      </div>

      <div className={`space-y-4 ${isFocusPresentation ? "p-6" : "p-5"}`}>
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
            className={`flex flex-wrap items-center gap-2 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
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
            {loopToggleLabel}
          </button>
          <span
            className={`rounded-full px-3 py-1 text-xs ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}
          >
            Output {effectiveVolume}%
          </span>
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
            <div
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
              onClick={() => setTrackOptionsOpen(false)}
            />
            <div
              className={`relative flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border shadow-[0_30px_120px_rgba(15,23,42,0.45)] ${
                isDarkMode
                  ? "border-slate-700 bg-slate-950 text-slate-100"
                  : "border-white bg-white text-slate-900"
              }`}
            >
              <div
                className={`flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-5 ${
                  isDarkMode
                    ? "border-slate-800 bg-slate-950/85"
                    : "border-slate-200 bg-white/95"
                }`}
              >
                <div className="space-y-1.5">
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}
                  >
                    Track options
                  </p>
                  <h3
                    className={`text-xl font-semibold sm:text-2xl ${isDarkMode ? "text-slate-50" : "text-slate-950"}`}
                  >
                    {channel.video.title}
                  </h3>
                  <p
                    className={`max-w-2xl text-[13px] leading-5 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                  >
                    Everything for timing, tone, and sync lives here. Leave the
                    tile clean and use this panel when you need to dial the
                    track in.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTrackOptionsOpen(false)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg transition ${
                    isDarkMode
                      ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                  }`}
                  aria-label="Close track options"
                >
                  ×
                </button>
              </div>
              <div
                className={`flex-1 overflow-y-auto p-3 sm:p-4 ${isDarkMode ? "bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_35%)]" : "bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.10),_transparent_35%)]"}`}
              >
                <div className="space-y-3">
                  <LoopRegionEditor
                    currentTimeSeconds={channel.progressSeconds}
                    durationSeconds={trackDurationSeconds}
                    isDarkMode={isDarkMode}
                    isPlaying={transportPlaying && !channel.paused}
                    loopEndSeconds={channel.loopEndSeconds}
                    loopStartSeconds={channel.loopStartSeconds}
                    onClearLoop={clearLoopRegion}
                    onSeek={(seconds) => {
                      seekPlayback(seconds);
                    }}
                    onSetLoopEnd={updateLoopEnd}
                    onSetLoopStart={updateLoopStart}
                    playbackRate={channel.playbackRate}
                    waveformDataUrl={waveformDataUrl}
                    trackLabel={trackLabel}
                  />

                  <StepSequencer
                    currentStepIndex={currentStepIndex}
                    enabled={channel.stepSequencerEnabled}
                    isDarkMode={isDarkMode}
                    onChangePattern={(nextPattern) =>
                      onPatchChannel(channel.id, {
                        stepPattern: nextPattern,
                      })
                    }
                    onToggleEnabled={() =>
                      onPatchChannel(channel.id, {
                        stepSequencerEnabled: !channel.stepSequencerEnabled,
                      })
                    }
                    pattern={channel.stepPattern}
                    trackLabel={trackLabel}
                  />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div
                      className={`rounded-[18px] border px-3 py-3 ${isDarkMode ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p
                            className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}
                          >
                            Speed
                          </p>
                          <p
                            className={`mt-0.5 text-[13px] leading-5 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                          >
                            Slow down or speed up this track.
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isDarkMode ? "bg-slate-800 text-slate-200" : "bg-white text-slate-700"}`}
                        >
                          {channel.playbackRate.toFixed(2)}x
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}
                        >
                          0.25x
                        </span>
                        <input
                          type="range"
                          min={0.25}
                          max={4}
                          step={0.25}
                          value={channel.playbackRate}
                          onChange={(event) =>
                            onPatchChannel(channel.id, {
                              playbackRate: Number(event.target.value),
                            })
                          }
                          className="tubetable-slider h-2 w-full cursor-pointer appearance-none"
                          aria-label={`${trackLabel} playback speed`}
                        />
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}
                        >
                          4x
                        </span>
                      </div>
                    </div>

                    <div
                      className={`rounded-[18px] border px-3 py-3 ${isDarkMode ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p
                            className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}
                          >
                            Reverb
                          </p>
                          <p
                            className={`mt-0.5 text-[13px] leading-5 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                          >
                            Dial in space, decay, and pre-delay.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onPatchChannel(channel.id, {
                                reverbEnabled: !channel.reverbEnabled,
                              })
                            }
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
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
                            {channel.reverbEnabled ? "On" : "Off"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedEffects((current) => ({
                                ...current,
                                reverb: !current.reverb,
                              }))
                            }
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg leading-none transition ${
                              isDarkMode
                                ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                                : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                            }`}
                            aria-expanded={expandedEffects.reverb}
                            aria-label={`${expandedEffects.reverb ? "Collapse" : "Expand"} reverb controls`}
                          >
                            <span
                              className={`transition-transform ${expandedEffects.reverb ? "rotate-180" : ""}`}
                              aria-hidden="true"
                            >
                              ⌄
                            </span>
                          </button>
                        </div>
                      </div>
                      {expandedEffects.reverb ? (
                        <div className="mt-3 space-y-3">
                          <label className="block">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span
                                className={`font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                              >
                                Mix
                              </span>
                              <span
                                className={
                                  isDarkMode
                                    ? "text-slate-200"
                                    : "text-slate-700"
                                }
                              >
                                {channel.reverbMix}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={channel.reverbMix}
                              onChange={(event) =>
                                onPatchChannel(channel.id, {
                                  reverbMix: Number(event.target.value),
                                })
                              }
                              className="tubetable-slider h-2 w-full cursor-pointer appearance-none"
                              aria-label={`${trackLabel} reverb mix`}
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span
                                className={`font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                              >
                                Decay
                              </span>
                              <span
                                className={
                                  isDarkMode
                                    ? "text-slate-200"
                                    : "text-slate-700"
                                }
                              >
                                {channel.reverbDecay}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={channel.reverbDecay}
                              onChange={(event) =>
                                onPatchChannel(channel.id, {
                                  reverbDecay: Number(event.target.value),
                                })
                              }
                              className="tubetable-slider h-2 w-full cursor-pointer appearance-none"
                              aria-label={`${trackLabel} reverb decay`}
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span
                                className={`font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                              >
                                Pre-delay
                              </span>
                              <span
                                className={
                                  isDarkMode
                                    ? "text-slate-200"
                                    : "text-slate-700"
                                }
                              >
                                {channel.reverbPreDelayMs} ms
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={200}
                              value={channel.reverbPreDelayMs}
                              onChange={(event) =>
                                onPatchChannel(channel.id, {
                                  reverbPreDelayMs: Number(event.target.value),
                                })
                              }
                              className="tubetable-slider h-2 w-full cursor-pointer appearance-none"
                              aria-label={`${trackLabel} reverb pre-delay`}
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>

                    <div
                      className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p
                            className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}
                          >
                            Beat sync
                          </p>
                          <p
                            className={`mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                          >
                            {syncLockLabel}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedEffects((current) => ({
                              ...current,
                              sync: !current.sync,
                            }))
                          }
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg leading-none transition ${
                            isDarkMode
                              ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                              : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                          }`}
                          aria-expanded={expandedEffects.sync}
                          aria-label={`${expandedEffects.sync ? "Collapse" : "Expand"} beat sync controls`}
                        >
                          <span
                            className={`transition-transform ${expandedEffects.sync ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          >
                            ⌄
                          </span>
                        </button>
                      </div>
                      {expandedEffects.sync ? (
                        <div className="mt-3 space-y-3">
                          <div
                            className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-700 bg-slate-900/60" : "border-slate-200 bg-white"}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p
                                  className={`text-xs font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                                >
                                  Track tempo
                                </p>
                                <p
                                  className={`mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                                >
                                  Tap this track twice to capture its BPM.
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${isDarkMode ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"}`}
                              >
                                {trackTempoLabel}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={handleTrackTapTempo}
                              className={`mt-3 w-full rounded-2xl border px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] transition ${
                                isDarkMode
                                  ? "border-slate-700 bg-slate-900 text-slate-100 hover:border-sky-400 hover:text-sky-200"
                                  : "border-slate-200 bg-white text-slate-800 hover:border-blue-200 hover:text-blue-700"
                              }`}
                            >
                              Tap tempo
                            </button>
                            <label className="mt-3 block">
                              <span
                                className={`mb-2 block text-xs font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                              >
                                BPM
                              </span>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={trackTempoInput}
                                  onChange={(event) =>
                                    setTrackTempoInput(event.target.value)
                                  }
                                  onBlur={commitTrackTempoInput}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.currentTarget.blur();
                                    }
                                  }}
                                  placeholder="Enter BPM"
                                  className={`min-w-0 flex-1 rounded-2xl border px-4 py-3 text-sm font-medium outline-none transition placeholder:text-slate-400 ${
                                    isDarkMode
                                      ? "border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-400 focus:bg-slate-950"
                                      : "border-slate-200 bg-white text-slate-900 focus:border-blue-300 focus:bg-white"
                                  }`}
                                  aria-label={`${trackLabel} tempo bpm`}
                                />
                                {trackTempoBpm !== null ? (
                                  <button
                                    type="button"
                                    onClick={() => applyTrackTempo(null)}
                                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] transition ${
                                      isDarkMode
                                        ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-red-400 hover:text-red-300"
                                        : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:text-red-600"
                                    }`}
                                  >
                                    Clear
                                  </button>
                                ) : null}
                              </div>
                            </label>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => adjustTrackTempo(0.5)}
                                className={`flex-1 rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                                  isDarkMode
                                    ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400 hover:text-sky-200"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
                                }`}
                              >
                                Half
                              </button>
                              <button
                                type="button"
                                onClick={() => adjustTrackTempo(2)}
                                className={`flex-1 rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                                  isDarkMode
                                    ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400 hover:text-sky-200"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
                                }`}
                              >
                                Double
                              </button>
                            </div>
                          </div>

                          <label className="block">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span
                                className={`font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                              >
                                Reference
                              </span>
                            </div>
                            <select
                              value={channel.beatSyncSourceChannelId ?? ""}
                              onChange={(event) =>
                                onPatchChannel(channel.id, {
                                  beatSyncSourceChannelId:
                                    event.target.value || null,
                                })
                              }
                              className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${
                                isDarkMode
                                  ? "border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-400"
                                  : "border-slate-200 bg-white text-slate-900 focus:border-blue-300"
                              }`}
                            >
                              <option value="">Tap tempo grid</option>
                              {channelStates
                                .filter((other) => other.id !== channel.id)
                                .map((other) => (
                                  <option key={other.id} value={other.id}>
                                    {other.video.title}
                                    {other.tempoBpm
                                      ? ` (${other.tempoBpm} BPM)`
                                      : ""}
                                  </option>
                                ))}
                            </select>
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              const sourceTime =
                                beatSyncSourceChannel?.progressSeconds ??
                                channel.progressSeconds;
                              const beatLengthSeconds = beatSyncSourceTempoBpm
                                ? 60 / beatSyncSourceTempoBpm
                                : null;
                              const nextProgressSeconds = beatLengthSeconds
                                ? Math.max(
                                    0,
                                    Math.round(sourceTime / beatLengthSeconds) *
                                      beatLengthSeconds,
                                  )
                                : Math.max(0, sourceTime);

                              onPatchChannel(channel.id, {
                                progressSeconds: nextProgressSeconds,
                              });

                              audioControllerRef.current?.seek(
                                nextProgressSeconds,
                              );
                              if (playerRef.current) {
                                try {
                                  playerRef.current.seekTo(
                                    nextProgressSeconds,
                                    true,
                                  );
                                } catch {
                                  // The iframe can briefly reject seeks while buffering.
                                }
                              }
                            }}
                            className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] transition ${
                              isDarkMode
                                ? "border-slate-700 bg-slate-900 text-slate-100 hover:border-sky-400 hover:text-sky-200"
                                : "border-slate-200 bg-white text-slate-800 hover:border-blue-200 hover:text-blue-700"
                            }`}
                          >
                            Sync now
                          </button>

                          <p
                            className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                          >
                            {beatSyncSourceTempoBpm
                              ? `Using ${beatSyncSourceTempoBpm} BPM as the beat grid.`
                              : "Tap tempo first for the tightest sync."}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div
                      className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p
                            className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}
                          >
                            Delay
                          </p>
                          <p
                            className={`mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                          >
                            Tune the repeats and feedback.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onPatchChannel(channel.id, {
                                delayEnabled: !channel.delayEnabled,
                              })
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
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
                            {channel.delayEnabled ? "On" : "Off"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedEffects((current) => ({
                                ...current,
                                delay: !current.delay,
                              }))
                            }
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg leading-none transition ${
                              isDarkMode
                                ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                                : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                            }`}
                            aria-expanded={expandedEffects.delay}
                            aria-label={`${expandedEffects.delay ? "Collapse" : "Expand"} delay controls`}
                          >
                            <span
                              className={`transition-transform ${expandedEffects.delay ? "rotate-180" : ""}`}
                              aria-hidden="true"
                            >
                              ⌄
                            </span>
                          </button>
                        </div>
                      </div>
                      {expandedEffects.delay ? (
                        <div className="mt-3 space-y-3">
                          <label className="block">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span
                                className={`font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                              >
                                Mix
                              </span>
                              <span
                                className={
                                  isDarkMode
                                    ? "text-slate-200"
                                    : "text-slate-700"
                                }
                              >
                                {channel.delayMix}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={channel.delayMix}
                              onChange={(event) =>
                                onPatchChannel(channel.id, {
                                  delayMix: Number(event.target.value),
                                })
                              }
                              className="tubetable-slider h-2 w-full cursor-pointer appearance-none"
                              aria-label={`${trackLabel} delay mix`}
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span
                                className={`font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                              >
                                Feedback
                              </span>
                              <span
                                className={
                                  isDarkMode
                                    ? "text-slate-200"
                                    : "text-slate-700"
                                }
                              >
                                {channel.delayFeedback}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={channel.delayFeedback}
                              onChange={(event) =>
                                onPatchChannel(channel.id, {
                                  delayFeedback: Number(event.target.value),
                                })
                              }
                              className="tubetable-slider h-2 w-full cursor-pointer appearance-none"
                              aria-label={`${trackLabel} delay feedback`}
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span
                                className={`font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                              >
                                Time
                              </span>
                              <span
                                className={
                                  isDarkMode
                                    ? "text-slate-200"
                                    : "text-slate-700"
                                }
                              >
                                {channel.delayTimeMs} ms
                              </span>
                            </div>
                            <input
                              type="range"
                              min={20}
                              max={900}
                              step={10}
                              value={channel.delayTimeMs}
                              onChange={(event) =>
                                onPatchChannel(channel.id, {
                                  delayTimeMs: Number(event.target.value),
                                })
                              }
                              className="tubetable-slider h-2 w-full cursor-pointer appearance-none"
                              aria-label={`${trackLabel} delay time`}
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>

                    <div
                      className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p
                            className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}
                          >
                            Lofi
                          </p>
                          <p
                            className={`mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                          >
                            Darken and soften the track.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onPatchChannel(channel.id, {
                                lofiEnabled: !channel.lofiEnabled,
                              })
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
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
                            {channel.lofiEnabled ? "On" : "Off"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedEffects((current) => ({
                                ...current,
                                lofi: !current.lofi,
                              }))
                            }
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg leading-none transition ${
                              isDarkMode
                                ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                                : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                            }`}
                            aria-expanded={expandedEffects.lofi}
                            aria-label={`${expandedEffects.lofi ? "Collapse" : "Expand"} lofi controls`}
                          >
                            <span
                              className={`transition-transform ${expandedEffects.lofi ? "rotate-180" : ""}`}
                              aria-hidden="true"
                            >
                              ⌄
                            </span>
                          </button>
                        </div>
                      </div>
                      {expandedEffects.lofi ? (
                        <div className="mt-3 space-y-3">
                          <label className="block">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span
                                className={`font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                              >
                                Mix
                              </span>
                              <span
                                className={
                                  isDarkMode
                                    ? "text-slate-200"
                                    : "text-slate-700"
                                }
                              >
                                {channel.lofiMix}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={channel.lofiMix}
                              onChange={(event) =>
                                onPatchChannel(channel.id, {
                                  lofiMix: Number(event.target.value),
                                })
                              }
                              className="tubetable-slider h-2 w-full cursor-pointer appearance-none"
                              aria-label={`${trackLabel} lofi mix`}
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span
                                className={`font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                              >
                                Cutoff
                              </span>
                              <span
                                className={
                                  isDarkMode
                                    ? "text-slate-200"
                                    : "text-slate-700"
                                }
                              >
                                {channel.lofiCutoffHz} Hz
                              </span>
                            </div>
                            <input
                              type="range"
                              min={300}
                              max={12000}
                              step={50}
                              value={channel.lofiCutoffHz}
                              onChange={(event) =>
                                onPatchChannel(channel.id, {
                                  lofiCutoffHz: Number(event.target.value),
                                })
                              }
                              className="tubetable-slider h-2 w-full cursor-pointer appearance-none"
                              aria-label={`${trackLabel} lofi cutoff`}
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>

                    <div
                      className={`rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p
                            className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}
                          >
                            Pitch
                          </p>
                          <p
                            className={`mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                          >
                            Shift pitch without touching the transport speed.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const nextEnabled = !channel.pitchShiftEnabled;
                              const nextSemitones = nextEnabled
                                ? channel.pitchShiftSemitones || 0
                                : 0;
                              onPatchChannel(channel.id, {
                                pitchShiftEnabled: nextEnabled,
                                pitchShiftSemitones: nextSemitones,
                              });
                            }}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                              channel.pitchShiftEnabled
                                ? isDarkMode
                                  ? "border-sky-400/40 bg-sky-500/15 text-sky-200"
                                  : "border-blue-200 bg-blue-50 text-blue-700"
                                : isDarkMode
                                  ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                            }`}
                            aria-pressed={channel.pitchShiftEnabled}
                          >
                            {channel.pitchShiftEnabled ? "On" : "Off"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedEffects((current) => ({
                                ...current,
                                pitch: !current.pitch,
                              }))
                            }
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg leading-none transition ${
                              isDarkMode
                                ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                                : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                            }`}
                            aria-expanded={expandedEffects.pitch}
                            aria-label={`${expandedEffects.pitch ? "Collapse" : "Expand"} pitch controls`}
                          >
                            <span
                              className={`transition-transform ${expandedEffects.pitch ? "rotate-180" : ""}`}
                              aria-hidden="true"
                            >
                              ⌄
                            </span>
                          </button>
                        </div>
                      </div>
                      {expandedEffects.pitch ? (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}
                            >
                              -12
                            </span>
                            <input
                              type="range"
                              min={-12}
                              max={12}
                              step={1}
                              value={channel.pitchShiftSemitones}
                              onChange={(event) =>
                                onPatchChannel(channel.id, {
                                  pitchShiftEnabled: true,
                                  pitchShiftSemitones: Number(
                                    event.target.value,
                                  ),
                                })
                              }
                              className="tubetable-slider h-2 w-full cursor-pointer appearance-none"
                              aria-label={`${trackLabel} pitch shift`}
                            />
                            <span
                              className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}
                            >
                              +12
                            </span>
                          </div>
                          <p
                            className={`text-right text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                          >
                            {channel.pitchShiftSemitones > 0 ? "+" : ""}
                            {channel.pitchShiftSemitones} semitones
                          </p>
                        </div>
                      ) : null}
                    </div>
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
