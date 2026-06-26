import {
  type AudioDiagnostics,
  createAudioDiagnostics,
  isAudioDiagnosticsEnabled,
} from "./audioDiagnostics";

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

function createImpulseResponse(context: AudioContextLike, decaySeconds: number) {
  const length = Math.max(1, Math.floor(context.sampleRate * decaySeconds));
  const buffer = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    let previous = 0;
    for (let index = 0; index < length; index += 1) {
      const normalized = index / length;
      const decay = Math.exp(-normalized * 5.4);
      const noise = (Math.random() * 2 - 1) * 0.42;
      previous = previous * 0.72 + noise * 0.28;
      data[index] = previous * decay;
    }
  }

  return buffer;
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
  private readonly dryGain: GainNode;
  private readonly lofiHighpassFilter: BiquadFilterNode;
  private readonly lofiFilter: BiquadFilterNode;
  private readonly lofiWetGain: GainNode;
  private readonly mixGain: GainNode;
  private readonly masterGain: GainNode;
  private readonly delayNode: DelayNode;
  private readonly delayFeedbackGain: GainNode;
  private readonly delayWetGain: GainNode;
  private readonly reverbPreDelay: DelayNode;
  private readonly reverbConvolver: ConvolverNode;
  private readonly reverbToneFilter: BiquadFilterNode;
  private readonly reverbWetGain: GainNode;
  private readonly diagnostics: AudioDiagnostics;
  private readonly listeners: Array<{
    target: HTMLAudioElement;
    type: keyof HTMLMediaElementEventMap;
    listener: EventListener;
  }> = [];
  private readonly audioUrl: string;
  private pendingSeekSeconds: number | null = null;
  private destroyed = false;
  private currentEffects: TrackEffectState | null = null;
  private currentPitchShiftSemitones = 0;
  private mediaStartSeconds = 0;

  constructor({ audioUrl, debugLabel, onEnded, onError, onReady }: TrackAudioOptions) {
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
    this.audio.src = buildAudioUrl(audioUrl, 0, 0);

    this.diagnostics.record("create-controller", {
      audioUrl,
      ...this.getContextSnapshot(),
    });

    this.source = this.context.createMediaElementSource(this.audio);
    this.dryGain = this.context.createGain();
    this.lofiHighpassFilter = this.context.createBiquadFilter();
    this.lofiFilter = this.context.createBiquadFilter();
    this.lofiWetGain = this.context.createGain();
    this.mixGain = this.context.createGain();
    this.masterGain = this.context.createGain();
    this.delayNode = this.context.createDelay(8);
    this.delayFeedbackGain = this.context.createGain();
    this.delayWetGain = this.context.createGain();
    this.reverbPreDelay = this.context.createDelay(2.5);
    this.reverbConvolver = this.context.createConvolver();
    this.reverbToneFilter = this.context.createBiquadFilter();
    this.reverbWetGain = this.context.createGain();

    this.lofiHighpassFilter.type = "highpass";
    this.lofiHighpassFilter.frequency.value = 80;
    this.lofiHighpassFilter.Q.value = 0.7;
    this.lofiFilter.type = "lowpass";
    this.lofiFilter.frequency.value = 2400;
    this.lofiFilter.Q.value = 0.8;
    this.reverbToneFilter.type = "lowpass";
    this.reverbToneFilter.frequency.value = 5600;
    this.reverbToneFilter.Q.value = 0.45;

    this.dryGain.gain.value = 1;
    this.lofiWetGain.gain.value = 0;
    this.mixGain.gain.value = 1;
    this.masterGain.gain.value = 0.76;
    this.delayNode.delayTime.value = 0.29;
    this.delayFeedbackGain.gain.value = 0.36;
    this.delayWetGain.gain.value = 0;
    this.reverbPreDelay.delayTime.value = 0.012;
    this.replaceReverbBuffer(1.6, "initial");
    this.reverbWetGain.gain.value = 0;

    this.source.connect(this.dryGain);
    this.source.connect(this.lofiHighpassFilter);
    this.lofiHighpassFilter.connect(this.lofiFilter);
    this.lofiFilter.connect(this.lofiWetGain);
    this.dryGain.connect(this.mixGain);
    this.lofiWetGain.connect(this.mixGain);

    this.source.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.delayWetGain);
    this.delayWetGain.connect(this.mixGain);

    this.source.connect(this.reverbPreDelay);
    this.reverbPreDelay.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbToneFilter);
    this.reverbToneFilter.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.mixGain);

    this.mixGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);

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

  private replaceReverbBuffer(decaySeconds: number, reason: string) {
    const startedAt = performance.now();
    this.reverbConvolver.buffer = createImpulseResponse(this.context, decaySeconds);
    this.diagnostics.record("impulse-response", {
      reason,
      decaySeconds,
      durationMs: Math.round(performance.now() - startedAt),
      ...this.getContextSnapshot(),
    });
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

    this.masterGain.gain.value = clamp(volume, 76, 0, 100) / 100;
    this.diagnostics.record("set-volume", {
      requestedVolume: volume,
      masterGain: this.masterGain.gain.value,
    });
  }

  setEffects(effects: TrackEffectState) {
    if (this.destroyed) {
      return;
    }

    const lofiMix = effects.lofiEnabled ? clamp(effects.lofiMix, 40, 0, 100) / 100 : 0;
    this.dryGain.gain.value = 1 - lofiMix;
    this.lofiWetGain.gain.value = lofiMix;
    this.lofiHighpassFilter.frequency.value = effects.lofiEnabled ? clamp(effects.lofiHighpassHz, 80, 20, 1200) : 20;
    this.lofiFilter.frequency.value = effects.lofiEnabled ? clamp(effects.lofiCutoffHz, 2400, 300, 12000) : 22050;
    this.lofiFilter.Q.value = effects.lofiEnabled ? 0.95 : 0.1;

    this.delayWetGain.gain.value = effects.delayEnabled ? clamp(effects.delayMix, 28, 0, 100) / 100 : 0;
    this.delayNode.delayTime.value = clamp(effects.delayTimeMs, 290, 20, 900) / 1000;
    this.delayFeedbackGain.gain.value = effects.delayEnabled ? clamp(effects.delayFeedback, 36, 0, 92) / 100 : 0;

    this.reverbPreDelay.delayTime.value = clamp(effects.reverbPreDelayMs, 12, 0, 200) / 1000;
    this.reverbWetGain.gain.value = effects.reverbEnabled ? clamp(effects.reverbMix, 22, 0, 35) / 100 : 0;

    const reverbDecay = clamp(effects.reverbDecay, 55, 0, 100);
    const decaySeconds = 0.45 + (reverbDecay / 100) * 3.1;
    if (
      !this.currentEffects ||
      Math.abs(clamp(this.currentEffects.reverbDecay, 55, 0, 100) - reverbDecay) > 2 ||
      !this.reverbConvolver.buffer
    ) {
      this.replaceReverbBuffer(decaySeconds, "effect-change");
    }

    this.currentEffects = { ...effects };
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
      this.source.disconnect();
      this.dryGain.disconnect();
      this.lofiHighpassFilter.disconnect();
      this.lofiFilter.disconnect();
      this.lofiWetGain.disconnect();
      this.mixGain.disconnect();
      this.masterGain.disconnect();
      this.delayNode.disconnect();
      this.delayFeedbackGain.disconnect();
      this.delayWetGain.disconnect();
      this.reverbPreDelay.disconnect();
      this.reverbConvolver.disconnect();
      this.reverbToneFilter.disconnect();
      this.reverbWetGain.disconnect();
    } catch {
      // Disconnect operations can fail if the graph is already torn down.
    }

    this.audio.removeAttribute("src");
    this.audio.load();
  }
}
