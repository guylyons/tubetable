import {
  type AudioDiagnostics,
  createAudioDiagnostics,
  isAudioDiagnosticsEnabled,
} from "./audioDiagnostics";
import { createTrackDspChain } from "./trackDsp";

export type TrackEffectState = {
  reverbEnabled: boolean;
  reverbMix: number;
  reverbDecay: number;
  reverbPreDelayMs: number;
  delayEnabled: boolean;
  delayMix: number;
  delayFeedback: number;
  delayTimeMs: number;
  lofiEnabled: boolean;
  lofiMix: number;
  lofiCutoffHz: number;
  lofiHighpassHz: number;
};

type TrackAudioOptions = {
  debugLabel?: string;
  audioUrl: string;
  initialStartSeconds?: number;
  onEnded: () => void;
  onError: (message: string) => void;
  onReady: () => void;
};

type AudioContextLike = AudioContext;

let sharedAudioContext: AudioContextLike | null = null;

function clamp(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function getAudioContext() {
  if (typeof window === "undefined") {
    throw new Error("Audio playback is only available in the browser.");
  }

  if (!sharedAudioContext) {
    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) {
      throw new Error("Web Audio API is not available in this browser.");
    }

    sharedAudioContext = new AudioContextCtor();
  }

  return sharedAudioContext;
}

export async function primeSharedAudioContext() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const context = getAudioContext();
    if (context.state === "suspended") {
      await context.resume();
    }
  } catch (error) {
    console.warn("[tubetable audio] failed to prime audio context", error);
  }
}

function buildAudioUrl(audioUrl: string, pitchShiftSemitones: number, startSeconds: number) {
  const url = new URL(audioUrl, window.location.origin);
  const normalized = Math.round(pitchShiftSemitones * 100) / 100;
  const normalizedStartSeconds = Math.max(0, Math.round(startSeconds * 100) / 100);

  if (normalized === 0) {
    url.searchParams.delete("pitchShiftSemitones");
  } else {
    url.searchParams.set("pitchShiftSemitones", String(normalized));
  }

  if (normalizedStartSeconds === 0) {
    url.searchParams.delete("startSeconds");
  } else {
    url.searchParams.set("startSeconds", String(normalizedStartSeconds));
  }

  return url.toString();
}

type AudioSyncState = {
  currentTime: number;
  isPaused: boolean;
  readyState: number;
  referenceSeconds: number;
  toleranceSeconds: number;
};

const HAVE_CURRENT_DATA = 2;

export function shouldReloadAudioForSync({
  currentTime,
  isPaused,
  readyState,
  referenceSeconds,
  toleranceSeconds,
}: AudioSyncState) {
  if (
    isPaused ||
    readyState < HAVE_CURRENT_DATA ||
    !Number.isFinite(currentTime) ||
    !Number.isFinite(referenceSeconds)
  ) {
    return false;
  }

  return currentTime - referenceSeconds > toleranceSeconds;
}

export class TrackAudioController {
  private readonly audio: HTMLAudioElement;
  private readonly context: AudioContextLike;
  private readonly source: MediaElementAudioSourceNode;
  private readonly dsp: ReturnType<typeof createTrackDspChain>;
  private readonly diagnostics: AudioDiagnostics;
  private readonly listeners: Array<{
    target: HTMLAudioElement;
    type: keyof HTMLMediaElementEventMap;
    listener: EventListener;
  }> = [];
  private readonly audioUrl: string;
  private pendingSeekSeconds: number | null = null;
  private destroyed = false;
  private currentPitchShiftSemitones = 0;
  private mediaStartSeconds = 0;

  constructor({ audioUrl, debugLabel, initialStartSeconds = 0, onEnded, onError, onReady }: TrackAudioOptions) {
    this.context = getAudioContext();
    this.diagnostics = createAudioDiagnostics({
      enabled: isAudioDiagnosticsEnabled(),
      label: debugLabel,
      logger: console,
    });
    this.audioUrl = audioUrl;
    this.audio = document.createElement("audio");
    this.audio.preload = "auto";
    this.audio.crossOrigin = "anonymous";
    (this.audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    this.audio.loop = false;
    this.audio.muted = false;
    this.audio.volume = 1;
    this.mediaStartSeconds = clamp(initialStartSeconds, 0, 0, Number.MAX_SAFE_INTEGER);
    this.audio.src = buildAudioUrl(audioUrl, 0, this.mediaStartSeconds);

    this.diagnostics.record("create-controller", {
      audioUrl,
      ...this.getContextSnapshot(),
    });

    this.source = this.context.createMediaElementSource(this.audio);
    this.dsp = createTrackDspChain({
      context: this.context,
      destination: this.context.destination,
      source: this.source,
      onImpulseResponse: ({ decaySeconds, durationMs, reason }) => {
        this.diagnostics.record("impulse-response", {
          reason,
          decaySeconds,
          durationMs,
          ...this.getContextSnapshot(),
        });
      },
    });

    const handleLoadedMetadata = () => {
      this.diagnostics.record("loaded-metadata", {
        duration: this.audio.duration,
        readyState: this.audio.readyState,
        mediaStartSeconds: this.mediaStartSeconds,
      });
    };

    const notifyReady = () => {
      if (!this.destroyed) {
        onReady();
      }
    };

    const handleEnded = () => {
      onEnded();
    };

    const handleError = () => {
      if (this.destroyed) {
        return;
      }

      const error = this.audio.error;
      console.error("[tubetable audio] media error", {
        debugLabel,
        code: error?.code,
        message: error?.message,
        src: this.audio.currentSrc || this.audio.src,
      });
      onError(error?.message || "Failed to load track audio.");
    };

    const logMediaState = (eventName: string) => {
      this.diagnostics.record("media-event", {
        eventName,
        readyState: this.audio.readyState,
        networkState: this.audio.networkState,
        paused: this.audio.paused,
        currentTime: this.getCurrentTime(),
        duration: this.audio.duration,
        ...this.getContextSnapshot(),
      });
    };

    const handleLoadStart = () => logMediaState("loadstart");
    const handleLoadedData = () => {
      logMediaState("loadeddata");
      notifyReady();
    };
    const handleCanPlay = () => {
      logMediaState("canplay");
      notifyReady();
    };
    const handleCanPlayThrough = () => {
      logMediaState("canplaythrough");
      notifyReady();
    };
    const handlePlaying = () => {
      logMediaState("playing");
      notifyReady();
    };
    const handleWaiting = () => logMediaState("waiting");
    const handleStalled = () => logMediaState("stalled");

    this.audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    this.audio.addEventListener("loadstart", handleLoadStart);
    this.audio.addEventListener("loadeddata", handleLoadedData);
    this.audio.addEventListener("canplay", handleCanPlay);
    this.audio.addEventListener("canplaythrough", handleCanPlayThrough);
    this.audio.addEventListener("playing", handlePlaying);
    this.audio.addEventListener("waiting", handleWaiting);
    this.audio.addEventListener("stalled", handleStalled);
    this.audio.addEventListener("ended", handleEnded);
    this.audio.addEventListener("error", handleError);

    this.listeners.push(
      { target: this.audio, type: "loadedmetadata", listener: handleLoadedMetadata },
      { target: this.audio, type: "loadstart", listener: handleLoadStart },
      { target: this.audio, type: "loadeddata", listener: handleLoadedData },
      { target: this.audio, type: "canplay", listener: handleCanPlay },
      { target: this.audio, type: "canplaythrough", listener: handleCanPlayThrough },
      { target: this.audio, type: "playing", listener: handlePlaying },
      { target: this.audio, type: "waiting", listener: handleWaiting },
      { target: this.audio, type: "stalled", listener: handleStalled },
      { target: this.audio, type: "ended", listener: handleEnded },
      { target: this.audio, type: "error", listener: handleError },
    );

    this.audio.load();
  }

  private getContextSnapshot() {
    const context = this.context as AudioContext & {
      outputLatency?: number;
    };

    return {
      contextState: context.state,
      contextTime: context.currentTime,
      sampleRate: context.sampleRate,
      baseLatency: context.baseLatency,
      outputLatency: context.outputLatency,
    };
  }

  private loadAt(startSeconds: number, autoplay = false) {
    if (this.destroyed) {
      return;
    }

    this.pendingSeekSeconds = null;
    this.mediaStartSeconds = clamp(startSeconds, 0, 0, Number.MAX_SAFE_INTEGER);
    this.audio.src = buildAudioUrl(
      this.audioUrl,
      this.currentPitchShiftSemitones,
      this.mediaStartSeconds,
    );
    this.audio.load();

    this.diagnostics.record("load", {
      src: this.audio.currentSrc || this.audio.src,
      mediaStartSeconds: this.mediaStartSeconds,
      autoplay,
    });

    if (autoplay) {
      void this.play();
    }
  }

  async play() {
    if (this.destroyed) {
      return;
    }

    this.diagnostics.record("play-request", {
      src: this.audio.currentSrc || this.audio.src,
      paused: this.audio.paused,
      playbackRate: this.audio.playbackRate,
      ...this.getContextSnapshot(),
    });

    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
        this.diagnostics.record("context-resumed", this.getContextSnapshot());
      } catch {
        console.warn("[tubetable audio] context resume rejected");
      }
    }

    try {
      await this.audio.play();
      this.diagnostics.record("play-resolved");
    } catch {
      console.warn("[tubetable audio] audio play rejected");
    }
  }

  pause() {
    if (this.destroyed) {
      return;
    }

    this.audio.pause();
  }

  seek(seconds: number) {
    if (this.destroyed) {
      return;
    }

    const nextSeconds = clamp(seconds, 0, 0, Number.MAX_SAFE_INTEGER);
    if (!Number.isFinite(nextSeconds)) {
      return;
    }

    this.loadAt(nextSeconds, !this.audio.paused);
  }

  setPlaybackRate(rate: number) {
    if (this.destroyed) {
      return;
    }

    this.audio.playbackRate = clamp(rate, 1, 0.5, 2);
    this.diagnostics.record("set-playback-rate", {
      requestedRate: rate,
      playbackRate: this.audio.playbackRate,
    });
  }

  setVolume(volume: number) {
    if (this.destroyed) {
      return;
    }

    const masterGain = this.dsp.setVolume(volume);
    this.diagnostics.record("set-volume", {
      requestedVolume: volume,
      masterGain,
    });
  }

  setEffects(effects: TrackEffectState) {
    if (this.destroyed) {
      return;
    }

    const { reverbDecay } = this.dsp.setEffects(effects);
    this.diagnostics.record("set-effects", {
      delayEnabled: effects.delayEnabled,
      delayMix: effects.delayMix,
      delayFeedback: effects.delayFeedback,
      delayTimeMs: effects.delayTimeMs,
      lofiEnabled: effects.lofiEnabled,
      lofiMix: effects.lofiMix,
      lofiCutoffHz: effects.lofiCutoffHz,
      lofiHighpassHz: effects.lofiHighpassHz,
      reverbEnabled: effects.reverbEnabled,
      reverbMix: effects.reverbMix,
      reverbDecay,
      reverbPreDelayMs: effects.reverbPreDelayMs,
    });
  }

  setPitchShift(pitchShiftEnabled: boolean, pitchShiftSemitones: number) {
    if (this.destroyed) {
      return;
    }

    const normalized = pitchShiftEnabled ? clamp(pitchShiftSemitones, 0, -12, 12) : 0;
    if (normalized === this.currentPitchShiftSemitones) {
      return;
    }

    const wasPlaying = !this.audio.paused;
    const currentTime = this.getCurrentTime();
    this.currentPitchShiftSemitones = normalized;

    const nextUrl = buildAudioUrl(this.audioUrl, normalized, currentTime);
    this.diagnostics.record("pitch-shift", {
      pitchShiftEnabled,
      pitchShiftSemitones: normalized,
      nextUrl,
    });

    this.loadAt(currentTime, wasPlaying);
  }

  getCurrentTime() {
    return this.mediaStartSeconds + this.audio.currentTime;
  }

  syncTo(referenceSeconds: number, toleranceSeconds = 0.35) {
    if (this.destroyed) {
      return;
    }

    const currentTime = this.getCurrentTime();
    const driftSeconds = currentTime - referenceSeconds;
    if (
      shouldReloadAudioForSync({
        currentTime,
        isPaused: this.audio.paused,
        readyState: this.audio.readyState,
        referenceSeconds,
        toleranceSeconds,
      })
    ) {
      this.diagnostics.record("sync-reload", {
        currentTime,
        referenceSeconds,
        driftSeconds,
        toleranceSeconds,
      });
      this.loadAt(referenceSeconds, true);
    }
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    for (const { target, type, listener } of this.listeners) {
      target.removeEventListener(type as string, listener);
    }

    try {
      this.audio.pause();
    } catch {
      // Ignore teardown errors.
    }

    try {
      this.dsp.disconnect();
    } catch {
      // Disconnect operations can fail if the graph is already torn down.
    }

    this.audio.removeAttribute("src");
    this.audio.load();
  }
}
