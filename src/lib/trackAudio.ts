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
};

type TrackAudioOptions = {
  debugLabel?: string;
  audioUrl: string;
  onEnded: () => void;
  onError: (message: string) => void;
  onMetadata?: (durationSeconds: number) => void;
  onTimeUpdate?: (currentTimeSeconds: number, durationSeconds: number) => void;
};

type AudioContextLike = AudioContext;

let sharedAudioContext: AudioContextLike | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getAudioContext() {
  if (typeof window === "undefined") {
    throw new Error("Audio playback is only available in the browser.");
  }

  if (!sharedAudioContext) {
    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

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

function createImpulseResponse(
  context: AudioContextLike,
  decaySeconds: number,
) {
  const length = Math.max(1, Math.floor(context.sampleRate * decaySeconds));
  const buffer = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const normalized = index / length;
      const decay = Math.pow(1 - normalized, 2.3);
      data[index] = (Math.random() * 2 - 1) * decay;
    }
  }

  return buffer;
}

function buildAudioUrl(audioUrl: string, pitchShiftSemitones: number) {
  const url = new URL(audioUrl, window.location.origin);
  const normalized = Math.round(pitchShiftSemitones * 100) / 100;

  if (normalized === 0) {
    url.searchParams.delete("pitchShiftSemitones");
  } else {
    url.searchParams.set("pitchShiftSemitones", String(normalized));
  }

  return url.toString();
}

export class TrackAudioController {
  private readonly audio: HTMLAudioElement;
  private readonly context: AudioContextLike;
  private readonly source: MediaElementAudioSourceNode;
  private readonly dryGain: GainNode;
  private readonly lofiFilter: BiquadFilterNode;
  private readonly lofiWetGain: GainNode;
  private readonly mixGain: GainNode;
  private readonly masterGain: GainNode;
  private readonly delayNode: DelayNode;
  private readonly delayFeedbackGain: GainNode;
  private readonly delayWetGain: GainNode;
  private readonly reverbPreDelay: DelayNode;
  private readonly reverbConvolver: ConvolverNode;
  private readonly reverbWetGain: GainNode;
  private readonly listeners: Array<{
    target: HTMLAudioElement;
    type: keyof HTMLAudioElementEventMap;
    listener: EventListener;
  }> = [];
  private readonly audioUrl: string;
  private pendingSeekSeconds: number | null = null;
  private destroyed = false;
  private currentEffects: TrackEffectState | null = null;
  private currentPitchShiftSemitones = 0;

  constructor(options: TrackAudioOptions) {
    const { audioUrl, debugLabel } = options;
    const onEnded = options.onEnded;
    const onError = options.onError;
    const onMetadata = options.onMetadata;
    const onTimeUpdate = options.onTimeUpdate;

    this.context = getAudioContext();
    this.audioUrl = audioUrl;
    this.audio = document.createElement("audio");
    this.audio.preload = "auto";
    this.audio.crossOrigin = "anonymous";
    this.audio.playsInline = true;
    this.audio.loop = false;
    this.audio.muted = false;
    this.audio.volume = 1;
    this.audio.src = buildAudioUrl(audioUrl, 0);

    console.info("[tubetable audio] create controller", {
      debugLabel,
      audioUrl,
      contextState: this.context.state,
    });

    this.source = this.context.createMediaElementSource(this.audio);
    this.dryGain = this.context.createGain();
    this.lofiFilter = this.context.createBiquadFilter();
    this.lofiWetGain = this.context.createGain();
    this.mixGain = this.context.createGain();
    this.masterGain = this.context.createGain();
    this.delayNode = this.context.createDelay(8);
    this.delayFeedbackGain = this.context.createGain();
    this.delayWetGain = this.context.createGain();
    this.reverbPreDelay = this.context.createDelay(2.5);
    this.reverbConvolver = this.context.createConvolver();
    this.reverbWetGain = this.context.createGain();

    this.lofiFilter.type = "lowpass";
    this.lofiFilter.frequency.value = 2400;
    this.lofiFilter.Q.value = 0.8;

    this.dryGain.gain.value = 1;
    this.lofiWetGain.gain.value = 0;
    this.mixGain.gain.value = 1;
    this.masterGain.gain.value = 0.76;
    this.delayNode.delayTime.value = 0.29;
    this.delayFeedbackGain.gain.value = 0.36;
    this.delayWetGain.gain.value = 0;
    this.reverbPreDelay.delayTime.value = 0.012;
    this.reverbConvolver.buffer = createImpulseResponse(this.context, 2.8);
    this.reverbWetGain.gain.value = 0;

    this.source.connect(this.dryGain);
    this.source.connect(this.lofiFilter);
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
    this.reverbConvolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.mixGain);

    this.mixGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);

    const handleLoadedMetadata = () => {
      console.info("[tubetable audio] loaded metadata", {
        debugLabel,
        duration: this.audio.duration,
        readyState: this.audio.readyState,
      });

      if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
        onMetadata?.(this.audio.duration);
      }

      if (this.pendingSeekSeconds !== null) {
        const nextSeek = this.pendingSeekSeconds;
        this.pendingSeekSeconds = null;
        this.seek(nextSeek);
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
      console.info("[tubetable audio] media event", {
        debugLabel,
        eventName,
        readyState: this.audio.readyState,
        networkState: this.audio.networkState,
        paused: this.audio.paused,
        currentTime: this.audio.currentTime,
        duration: this.audio.duration,
      });
    };

    const handleLoadStart = () => logMediaState("loadstart");
    const handleLoadedData = () => logMediaState("loadeddata");
    const handleCanPlay = () => logMediaState("canplay");
    const handleCanPlayThrough = () => logMediaState("canplaythrough");
    const handlePlaying = () => logMediaState("playing");
    const handleWaiting = () => logMediaState("waiting");
    const handleStalled = () => logMediaState("stalled");
    const handleTimeUpdate = () => {
      logMediaState("timeupdate");
      if (Number.isFinite(this.audio.currentTime)) {
        onTimeUpdate?.(
          this.audio.currentTime,
          Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
        );
      }
    };

    this.audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    this.audio.addEventListener("loadstart", handleLoadStart);
    this.audio.addEventListener("loadeddata", handleLoadedData);
    this.audio.addEventListener("canplay", handleCanPlay);
    this.audio.addEventListener("canplaythrough", handleCanPlayThrough);
    this.audio.addEventListener("playing", handlePlaying);
    this.audio.addEventListener("waiting", handleWaiting);
    this.audio.addEventListener("stalled", handleStalled);
    this.audio.addEventListener("timeupdate", handleTimeUpdate);
    this.audio.addEventListener("ended", handleEnded);
    this.audio.addEventListener("error", handleError);

    this.listeners.push(
      {
        target: this.audio,
        type: "loadedmetadata",
        listener: handleLoadedMetadata,
      },
      { target: this.audio, type: "loadstart", listener: handleLoadStart },
      { target: this.audio, type: "loadeddata", listener: handleLoadedData },
      { target: this.audio, type: "canplay", listener: handleCanPlay },
      {
        target: this.audio,
        type: "canplaythrough",
        listener: handleCanPlayThrough,
      },
      { target: this.audio, type: "playing", listener: handlePlaying },
      { target: this.audio, type: "waiting", listener: handleWaiting },
      { target: this.audio, type: "stalled", listener: handleStalled },
      { target: this.audio, type: "timeupdate", listener: handleTimeUpdate },
      { target: this.audio, type: "ended", listener: handleEnded },
      { target: this.audio, type: "error", listener: handleError },
    );
  }

  async play() {
    if (this.destroyed) {
      return;
    }

    console.info("[tubetable audio] play request", {
      src: this.audio.currentSrc || this.audio.src,
      paused: this.audio.paused,
      contextState: this.context.state,
      playbackRate: this.audio.playbackRate,
    });

    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
        console.info("[tubetable audio] context resumed", {
          contextState: this.context.state,
        });
      } catch {
        console.warn("[tubetable audio] context resume rejected");
      }
    }

    try {
      await this.audio.play();
      console.info("[tubetable audio] audio play resolved");
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

    const nextSeconds = Math.max(0, seconds);
    if (!Number.isFinite(nextSeconds)) {
      return;
    }

    if (
      !this.audio.duration ||
      Number.isNaN(this.audio.duration) ||
      this.audio.readyState < 1
    ) {
      this.pendingSeekSeconds = nextSeconds;
      return;
    }

    try {
      this.audio.currentTime = nextSeconds;
      this.pendingSeekSeconds = null;
      console.info("[tubetable audio] seek", {
        currentTime: this.audio.currentTime,
        target: nextSeconds,
      });
    } catch {
      this.pendingSeekSeconds = nextSeconds;
      console.info("[tubetable audio] seek deferred", {
        target: nextSeconds,
      });
    }
  }

  setPlaybackRate(rate: number) {
    if (this.destroyed) {
      return;
    }

    this.audio.playbackRate = rate;
    console.info("[tubetable audio] rate", rate);
  }

  setVolume(volume: number) {
    if (this.destroyed) {
      return;
    }

    this.masterGain.gain.value = clamp(volume / 100, 0, 1);
    console.info("[tubetable audio] volume", volume);
  }

  setEffects(effects: TrackEffectState) {
    if (this.destroyed) {
      return;
    }

    const lofiMix = effects.lofiEnabled
      ? clamp(effects.lofiMix / 100, 0, 1)
      : 0;
    this.dryGain.gain.value = 1 - lofiMix;
    this.lofiWetGain.gain.value = lofiMix;
    this.lofiFilter.frequency.value = effects.lofiEnabled
      ? clamp(effects.lofiCutoffHz, 300, 12000)
      : 22050;
    this.lofiFilter.Q.value = effects.lofiEnabled ? 0.95 : 0.1;

    this.delayWetGain.gain.value = effects.delayEnabled
      ? clamp(effects.delayMix / 100, 0, 1)
      : 0;
    this.delayNode.delayTime.value = clamp(
      effects.delayTimeMs / 1000,
      0.02,
      0.9,
    );
    this.delayFeedbackGain.gain.value = effects.delayEnabled
      ? clamp(effects.delayFeedback / 100, 0, 0.92)
      : 0;

    this.reverbPreDelay.delayTime.value = clamp(
      effects.reverbPreDelayMs / 1000,
      0,
      0.2,
    );
    this.reverbWetGain.gain.value = effects.reverbEnabled
      ? clamp(effects.reverbMix / 100, 0, 1)
      : 0;

    const decaySeconds = 0.9 + clamp(effects.reverbDecay / 100, 0, 1) * 6.2;
    if (
      !this.currentEffects ||
      Math.abs(this.currentEffects.reverbDecay - effects.reverbDecay) > 2 ||
      !this.reverbConvolver.buffer
    ) {
      this.reverbConvolver.buffer = createImpulseResponse(
        this.context,
        decaySeconds,
      );
    }

    this.currentEffects = { ...effects };
    console.info("[tubetable audio] effects", effects);
  }

  setPitchShift(pitchShiftEnabled: boolean, pitchShiftSemitones: number) {
    if (this.destroyed) {
      return;
    }

    const normalized = pitchShiftEnabled
      ? clamp(pitchShiftSemitones, -12, 12)
      : 0;
    if (normalized === this.currentPitchShiftSemitones) {
      return;
    }

    const wasPlaying = !this.audio.paused;
    const currentTime = this.audio.currentTime;
    this.currentPitchShiftSemitones = normalized;

    const nextUrl = buildAudioUrl(this.audioUrl, normalized);
    console.info("[tubetable audio] pitch shift", {
      pitchShiftEnabled,
      pitchShiftSemitones: normalized,
      nextUrl,
    });

    this.pendingSeekSeconds = currentTime;
    this.audio.src = nextUrl;
    this.audio.load();

    if (wasPlaying) {
      void this.play();
    }
  }

  getCurrentTime() {
    return this.audio.currentTime;
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    for (const { target, type, listener } of this.listeners) {
      target.removeEventListener(type, listener);
    }

    try {
      this.audio.pause();
    } catch {
      // Ignore teardown errors.
    }

    try {
      this.source.disconnect();
      this.dryGain.disconnect();
      this.lofiFilter.disconnect();
      this.lofiWetGain.disconnect();
      this.mixGain.disconnect();
      this.masterGain.disconnect();
      this.delayNode.disconnect();
      this.delayFeedbackGain.disconnect();
      this.delayWetGain.disconnect();
      this.reverbPreDelay.disconnect();
      this.reverbConvolver.disconnect();
      this.reverbWetGain.disconnect();
    } catch {
      // Disconnect operations can fail if the graph is already torn down.
    }

    this.audio.removeAttribute("src");
    this.audio.load();
  }
}
