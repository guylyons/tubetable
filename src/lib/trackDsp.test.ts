import { describe, expect, test } from "bun:test";
import { createTrackDspChain } from "./trackDsp";
import type { TrackEffectState } from "./trackAudio";

type FakeAudioParam = { value: number };

class FakeAudioNode {
  readonly connections: FakeAudioNode[] = [];

  connect(node: FakeAudioNode) {
    this.connections.push(node);
    return node;
  }

  disconnect() {
    this.connections.length = 0;
  }
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
  readonly sampleRate = 100;
  readonly destination = new FakeAudioNode();

  createGain() {
    return new FakeGainNode();
  }

  createDelay() {
    return new FakeDelayNode();
  }

  createBiquadFilter() {
    return new FakeBiquadFilterNode();
  }

  createConvolver() {
    return new FakeConvolverNode();
  }

  createBuffer(channelCount: number, length: number) {
    return new FakeAudioBuffer(channelCount, length);
  }
}

const enabledEffects: TrackEffectState = {
  delayEnabled: true,
  delayFeedback: 74,
  delayMix: 63,
  delayTimeMs: 420,
  lofiCutoffHz: 1100,
  lofiEnabled: true,
  lofiHighpassHz: 190,
  lofiMix: 70,
  reverbDecay: 84,
  reverbEnabled: true,
  reverbMix: 35,
  reverbPreDelayMs: 90,
};

describe("track DSP chain", () => {
  test("routes enabled effects into the audible mix with nonzero wet signal", () => {
    const context = new FakeAudioContext();
    const source = new FakeAudioNode();

    const dsp = createTrackDspChain({
      context: context as unknown as AudioContext,
      destination: context.destination as unknown as AudioNode,
      source: source as unknown as AudioNode,
    });

    dsp.setEffects(enabledEffects);

    expect(source.connections).toHaveLength(4);
    expect(dsp.nodes.dryGain.gain.value).toBeCloseTo(0.3, 5);
    expect(dsp.nodes.lofiWetGain.gain.value).toBeCloseTo(0.7, 5);
    expect(dsp.nodes.delayWetGain.gain.value).toBeCloseTo(0.63, 5);
    expect(dsp.nodes.delayFeedbackGain.gain.value).toBeCloseTo(0.74, 5);
    expect(dsp.nodes.reverbWetGain.gain.value).toBeCloseTo(0.35, 5);
    expect(dsp.nodes.mixGain.connections).toContain(dsp.nodes.masterGain);
    expect(dsp.nodes.masterGain.connections).toContain(context.destination);
  });

  test("does not rebuild the reverb impulse while applying initial effects or toggling reverb", () => {
    const context = new FakeAudioContext();
    const source = new FakeAudioNode();
    const impulseReasons: string[] = [];

    const dsp = createTrackDspChain({
      context: context as unknown as AudioContext,
      destination: context.destination as unknown as AudioNode,
      source: source as unknown as AudioNode,
      onImpulseResponse: ({ reason }) => {
        impulseReasons.push(reason);
      },
    });

    expect(impulseReasons).toEqual(["initial"]);

    dsp.setEffects({ ...enabledEffects, reverbEnabled: false });
    dsp.setEffects({ ...enabledEffects, reverbEnabled: true });
    dsp.setEffects({ ...enabledEffects, reverbEnabled: false });

    expect(impulseReasons).toEqual(["initial"]);

    dsp.disconnect();
  });
});
