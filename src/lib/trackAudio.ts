export type TrackEffectState = {
  reverbEnabled: boolean;
  delayEnabled: boolean;
  lofiEnabled: boolean;
};

type TrackAudioOptions = {
  debugLabel?: string;
  audioUrl: string;
  onEnded: () => void;
  onError: (message: string) => void;
};

type AudioContextLike = AudioContext;

let sharedAudioContext: AudioContextLike | null = null;

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

function createImpulseResponse(context: AudioContextLike, seconds = 2.4) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const decay = Math.pow(1 - index / length, 2.2);
      data[index] = (Math.random() * 2 - 1) * decay;
    }
  }

  return buffer;
}

export class TrackAudioController {
  private readonly audio: HTMLAudioElement;
  private readonly context: AudioContextLike;
  private readonly source: MediaElementAudioSourceNode;
  private readonly toneDryGain: GainNode;
  private readonly toneWetGain: GainNode;
  private readonly toneLowpass: BiquadFilterNode;
  private readonly volumeGain: GainNode;
  private readonly delayNode: DelayNode;
  private readonly delayFeedbackGain: GainNode;
  private readonly delayWetGain: GainNode;
  private readonly reverbConvolver: ConvolverNode;
  private readonly reverbWetGain: GainNode;
  private readonly effectMixGain: GainNode;
  private readonly listeners: Array<{
    target: HTMLAudioElement;
    type: keyof HTMLAudioElementEventMap;
    listener: EventListener;
  }> = [];
  private pendingSeekSeconds: number | null = null;
  private destroyed = false;

  constructor({ audioUrl, debugLabel, onEnded, onError }: TrackAudioOptions) {
    this.context = getAudioContext();
    this.audio = document.createElement("audio");
    this.audio.preload = "auto";
    this.audio.crossOrigin = "anonymous";
    this.audio.playsInline = true;
    this.audio.loop = false;
    this.audio.muted = false;
    this.audio.volume = 1;
    this.audio.src = audioUrl;

    console.info("[tubetable audio] create controller", {
      debugLabel,
      audioUrl,
      contextState: this.context.state,
    });

    this.source = this.context.createMediaElementSource(this.audio);
    this.toneDryGain = this.context.createGain();
    this.toneWetGain = this.context.createGain();
    this.toneLowpass = this.context.createBiquadFilter();
    this.volumeGain = this.context.createGain();
    this.delayNode = this.context.createDelay(8);
    this.delayFeedbackGain = this.context.createGain();
    this.delayWetGain = this.context.createGain();
    this.reverbConvolver = this.context.createConvolver();
    this.reverbWetGain = this.context.createGain();
    this.effectMixGain = this.context.createGain();

    this.toneLowpass.type = "lowpass";
    this.toneLowpass.frequency.value = 2200;
    this.toneLowpass.Q.value = 0.7;

    this.reverbConvolver.buffer = createImpulseResponse(this.context);

    this.toneDryGain.gain.value = 1;
    this.toneWetGain.gain.value = 0;
    this.volumeGain.gain.value = 0.76;
    this.delayNode.delayTime.value = 0.28;
    this.delayFeedbackGain.gain.value = 0.34;
    this.delayWetGain.gain.value = 0;
    this.reverbWetGain.gain.value = 0;

    this.source.connect(this.toneDryGain);
    this.source.connect(this.toneLowpass);
    this.toneLowpass.connect(this.toneWetGain);
    this.toneDryGain.connect(this.effectMixGain);
    this.toneWetGain.connect(this.effectMixGain);
    this.effectMixGain.connect(this.volumeGain);
    this.volumeGain.connect(this.context.destination);

    this.volumeGain.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.delayWetGain);
    this.delayWetGain.connect(this.context.destination);

    this.volumeGain.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.context.destination);

    const handleLoadedMetadata = () => {
      console.info("[tubetable audio] loaded metadata", {
        debugLabel,
        duration: this.audio.duration,
        readyState: this.audio.readyState,
      });
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
    const handleTimeUpdate = () => logMediaState("timeupdate");

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
      { target: this.audio, type: "loadedmetadata", listener: handleLoadedMetadata },
      { target: this.audio, type: "loadstart", listener: handleLoadStart },
      { target: this.audio, type: "loadeddata", listener: handleLoadedData },
      { target: this.audio, type: "canplay", listener: handleCanPlay },
      { target: this.audio, type: "canplaythrough", listener: handleCanPlayThrough },
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
        // The browser can temporarily deny audio resumes before a user gesture settles.
        console.warn("[tubetable audio] context resume rejected");
      }
    }

    try {
      await this.audio.play();
      console.info("[tubetable audio] audio play resolved");
    } catch {
      // Autoplay can be denied until the next user interaction.
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

    if (!this.audio.duration || Number.isNaN(this.audio.duration) || this.audio.readyState < 1) {
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

    this.volumeGain.gain.value = Math.min(1, Math.max(0, volume / 100));
    console.info("[tubetable audio] volume", volume);
  }

  setEffects(effects: TrackEffectState) {
    if (this.destroyed) {
      return;
    }

    const lofiWet = effects.lofiEnabled ? 0.62 : 0;
    this.toneDryGain.gain.value = effects.lofiEnabled ? 0.34 : 1;
    this.toneWetGain.gain.value = lofiWet;
    this.toneLowpass.frequency.value = effects.lofiEnabled ? 2100 : 22050;
    this.toneLowpass.Q.value = effects.lofiEnabled ? 0.9 : 0.1;

    this.delayWetGain.gain.value = effects.delayEnabled ? 0.28 : 0;
    this.delayNode.delayTime.value = effects.delayEnabled ? 0.26 : 0.01;
    this.delayFeedbackGain.gain.value = effects.delayEnabled ? 0.36 : 0;

    this.reverbWetGain.gain.value = effects.reverbEnabled ? 0.24 : 0;
    console.info("[tubetable audio] effects", effects);
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
      this.toneDryGain.disconnect();
      this.toneWetGain.disconnect();
      this.toneLowpass.disconnect();
      this.effectMixGain.disconnect();
      this.volumeGain.disconnect();
      this.delayNode.disconnect();
      this.delayFeedbackGain.disconnect();
      this.delayWetGain.disconnect();
      this.reverbConvolver.disconnect();
      this.reverbWetGain.disconnect();
    } catch {
      // Disconnect operations can fail if the graph is already torn down.
    }

    this.audio.removeAttribute("src");
    this.audio.load();
  }
}
