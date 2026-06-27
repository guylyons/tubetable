import { describe, expect, test } from "bun:test";
import { TrackAudioController, type TrackEffectState } from "./trackAudio";

type FakeListener = { type: string; listener: EventListener };
type FakeAudioParam = { value: number };
let latestFakeAudioContext: FakeAudioContext | null = null;

class FakeAudioElement {
  readonly listeners: FakeListener[] = [];
  readonly loadCalls: string[] = [];
  onLoad?: () => void;
  currentSrc = "";
  currentTime = 0;
  duration = 0;
  error: MediaError | null = null;
  loop = false;
  muted = false;
  networkState = 0;
  paused = true;
  playbackRate = 1;
  preload = "";
  readyState = 0;
  volume = 1;
  private source = "";

  get src() {
    return this.source;
  }

  set src(value: string) {
    this.source = value;
    this.currentSrc = value;
  }

  addEventListener(type: string, listener: EventListener) {
    this.listeners.push({ type, listener });
  }

  removeEventListener(type: string, listener: EventListener) {
    const index = this.listeners.findIndex((entry) => entry.type === type && entry.listener === listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  load() {
    this.loadCalls.push(this.src);
    this.onLoad?.();
  }

  pause() {
    this.paused = true;
  }

  async play() {
    this.paused = false;
  }

  removeAttribute(name: string) {
    if (name === "src") {
      this.src = "";
    }
  }
}

class FakeAudioNode {
  connect(node: FakeAudioNode) {
    return node;
  }

  disconnect() {}
}

class FakeGainNode extends FakeAudioNode {
  readonly gain: FakeAudioParam = { value: 1 };
}

class FakeDelayNode extends FakeAudioNode {
  readonly delayTime: FakeAudioParam = { value: 0 };
}

class FakeBiquadFilterNode extends FakeAudioNode {
  readonly frequency: FakeAudioParam = { value: 0 };
  readonly Q: FakeAudioParam = { value: 0 };
  type = "lowpass";
}

class FakeConvolverNode extends FakeAudioNode {
  buffer: unknown = null;
}

class FakeAudioBuffer {
  readonly numberOfChannels: number;
  readonly channels: Float32Array[];

  constructor(channelCount: number, length: number) {
    this.numberOfChannels = channelCount;
    this.channels = Array.from({ length: channelCount }, () => new Float32Array(length));
  }

  getChannelData(channel: number) {
    return this.channels[channel]!;
  }
}

class FakeAudioContext {
  readonly baseLatency = 0;
  readonly currentTime = 0;
  readonly destination = new FakeAudioNode();
  readonly gains: FakeGainNode[] = [];
  readonly sampleRate = 100;
  readonly state = "running";

  constructor() {
    latestFakeAudioContext = this;
  }

  createBiquadFilter() {
    return new FakeBiquadFilterNode();
  }

  createBuffer(channelCount: number, length: number) {
    return new FakeAudioBuffer(channelCount, length);
  }

  createConvolver() {
    return new FakeConvolverNode();
  }

  createDelay() {
    return new FakeDelayNode();
  }

  createGain() {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain;
  }

  createMediaElementSource() {
    return new FakeAudioNode();
  }
}

describe("TrackAudioController startup", () => {
  const enabledEffects: TrackEffectState = {
    delayEnabled: true,
    delayFeedback: 74,
    delayMix: 63,
    delayTimeMs: 420,
    lofiCutoffHz: 1800,
    lofiEnabled: true,
    lofiHighpassHz: 140,
    lofiMix: 70,
    reverbDecay: 65,
    reverbEnabled: true,
    reverbMix: 31,
    reverbPreDelayMs: 80,
  };

  test("loads once at the current video time when DSP starts mid-track", () => {
    const audio = new FakeAudioElement();
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    Object.assign(globalThis, {
      window: {
        location: { origin: "http://localhost" },
        AudioContext: FakeAudioContext,
      },
      document: {
        createElement: (tagName: string) => {
          if (tagName !== "audio") {
            throw new Error(`Unexpected element: ${tagName}`);
          }
          return audio;
        },
      },
    });

    try {
      const controller = new TrackAudioController({
        audioUrl: "/api/youtube/audio?videoId=abc",
        initialStartSeconds: 42.42,
        onEnded: () => {},
        onError: () => {},
        onReady: () => {},
      });

      expect(audio.loadCalls).toHaveLength(1);
      expect(audio.loadCalls[0]).toContain("startSeconds=42.42");

      controller.destroy();
    } finally {
      Object.assign(globalThis, {
        window: originalWindow,
        document: originalDocument,
      });
    }
  });

  test("applies initial effects before the first audio load", () => {
    const audio = new FakeAudioElement();
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    let context: FakeAudioContext | null = null;
    let gainsAtLoad: number[] | null = null;

    class CapturingAudioContext extends FakeAudioContext {
      constructor() {
        super();
        context = this;
      }
    }

    audio.onLoad = () => {
      const gains = (context ?? latestFakeAudioContext)?.gains ?? [];
      gainsAtLoad = gains.slice(-7).map((gain) => gain.gain.value);
    };

    Object.assign(globalThis, {
      window: {
        location: { origin: "http://localhost" },
        AudioContext: CapturingAudioContext,
      },
      document: {
        createElement: (tagName: string) => {
          if (tagName !== "audio") {
            throw new Error(`Unexpected element: ${tagName}`);
          }
          return audio;
        },
      },
    });

    try {
      const controller = new TrackAudioController({
        audioUrl: "/api/youtube/audio?videoId=abc",
        initialEffects: enabledEffects,
        onEnded: () => {},
        onError: () => {},
        onReady: () => {},
      });

      expect(gainsAtLoad).not.toBeNull();
      expect(gainsAtLoad?.[0]).toBeCloseTo(0.3, 5);
      expect(gainsAtLoad?.[1]).toBeCloseTo(0.7, 5);
      expect(gainsAtLoad?.[5]).toBeCloseTo(0.63, 5);
      expect(gainsAtLoad?.[6]).toBeCloseTo(0.31, 5);

      controller.destroy();
    } finally {
      Object.assign(globalThis, {
        window: originalWindow,
        document: originalDocument,
      });
    }
  });
});
