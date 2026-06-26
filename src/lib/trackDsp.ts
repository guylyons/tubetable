import type { TrackEffectState } from "./trackAudio";

type TrackDspChainOptions = {
  context: AudioContext;
  destination: AudioNode;
  source: AudioNode;
  onImpulseResponse?: (payload: { decaySeconds: number; durationMs: number; reason: string }) => void;
};

function clamp(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function createImpulseResponse(context: AudioContext, decaySeconds: number) {
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

export function createTrackDspChain({
  context,
  destination,
  source,
  onImpulseResponse,
}: TrackDspChainOptions) {
  const dryGain = context.createGain();
  const lofiHighpassFilter = context.createBiquadFilter();
  const lofiFilter = context.createBiquadFilter();
  const lofiWetGain = context.createGain();
  const mixGain = context.createGain();
  const masterGain = context.createGain();
  const delayNode = context.createDelay(8);
  const delayFeedbackGain = context.createGain();
  const delayWetGain = context.createGain();
  const reverbPreDelay = context.createDelay(2.5);
  const reverbConvolver = context.createConvolver();
  const reverbToneFilter = context.createBiquadFilter();
  const reverbWetGain = context.createGain();
  let currentEffects: TrackEffectState | null = null;

  function replaceReverbBuffer(decaySeconds: number, reason: string) {
    const startedAt = performance.now();
    reverbConvolver.buffer = createImpulseResponse(context, decaySeconds);
    onImpulseResponse?.({
      reason,
      decaySeconds,
      durationMs: Math.round(performance.now() - startedAt),
    });
  }

  lofiHighpassFilter.type = "highpass";
  lofiHighpassFilter.frequency.value = 80;
  lofiHighpassFilter.Q.value = 0.7;
  lofiFilter.type = "lowpass";
  lofiFilter.frequency.value = 2400;
  lofiFilter.Q.value = 0.8;
  reverbToneFilter.type = "lowpass";
  reverbToneFilter.frequency.value = 5600;
  reverbToneFilter.Q.value = 0.45;

  dryGain.gain.value = 1;
  lofiWetGain.gain.value = 0;
  mixGain.gain.value = 1;
  masterGain.gain.value = 0.76;
  delayNode.delayTime.value = 0.29;
  delayFeedbackGain.gain.value = 0.36;
  delayWetGain.gain.value = 0;
  reverbPreDelay.delayTime.value = 0.012;
  replaceReverbBuffer(1.6, "initial");
  reverbWetGain.gain.value = 0;

  source.connect(dryGain);
  source.connect(lofiHighpassFilter);
  lofiHighpassFilter.connect(lofiFilter);
  lofiFilter.connect(lofiWetGain);
  dryGain.connect(mixGain);
  lofiWetGain.connect(mixGain);

  source.connect(delayNode);
  delayNode.connect(delayFeedbackGain);
  delayFeedbackGain.connect(delayNode);
  delayNode.connect(delayWetGain);
  delayWetGain.connect(mixGain);

  source.connect(reverbPreDelay);
  reverbPreDelay.connect(reverbConvolver);
  reverbConvolver.connect(reverbToneFilter);
  reverbToneFilter.connect(reverbWetGain);
  reverbWetGain.connect(mixGain);

  mixGain.connect(masterGain);
  masterGain.connect(destination);

  return {
    nodes: {
      dryGain,
      lofiHighpassFilter,
      lofiFilter,
      lofiWetGain,
      mixGain,
      masterGain,
      delayNode,
      delayFeedbackGain,
      delayWetGain,
      reverbPreDelay,
      reverbConvolver,
      reverbToneFilter,
      reverbWetGain,
    },
    setEffects(effects: TrackEffectState) {
      const lofiMix = effects.lofiEnabled ? clamp(effects.lofiMix, 40, 0, 100) / 100 : 0;
      dryGain.gain.value = 1 - lofiMix;
      lofiWetGain.gain.value = lofiMix;
      lofiHighpassFilter.frequency.value = effects.lofiEnabled ? clamp(effects.lofiHighpassHz, 80, 20, 1200) : 20;
      lofiFilter.frequency.value = effects.lofiEnabled ? clamp(effects.lofiCutoffHz, 2400, 300, 12000) : 22050;
      lofiFilter.Q.value = effects.lofiEnabled ? 0.95 : 0.1;

      delayWetGain.gain.value = effects.delayEnabled ? clamp(effects.delayMix, 28, 0, 100) / 100 : 0;
      delayNode.delayTime.value = clamp(effects.delayTimeMs, 290, 20, 900) / 1000;
      delayFeedbackGain.gain.value = effects.delayEnabled ? clamp(effects.delayFeedback, 36, 0, 92) / 100 : 0;

      reverbPreDelay.delayTime.value = clamp(effects.reverbPreDelayMs, 12, 0, 200) / 1000;
      reverbWetGain.gain.value = effects.reverbEnabled ? clamp(effects.reverbMix, 22, 0, 35) / 100 : 0;

      const reverbDecay = clamp(effects.reverbDecay, 55, 0, 100);
      const decaySeconds = 0.45 + (reverbDecay / 100) * 3.1;
      if (
        !currentEffects ||
        Math.abs(clamp(currentEffects.reverbDecay, 55, 0, 100) - reverbDecay) > 2 ||
        !reverbConvolver.buffer
      ) {
        replaceReverbBuffer(decaySeconds, "effect-change");
      }

      currentEffects = { ...effects };
      return { reverbDecay };
    },
    setVolume(volume: number) {
      masterGain.gain.value = clamp(volume, 76, 0, 100) / 100;
      return masterGain.gain.value;
    },
    disconnect() {
      source.disconnect();
      dryGain.disconnect();
      lofiHighpassFilter.disconnect();
      lofiFilter.disconnect();
      lofiWetGain.disconnect();
      mixGain.disconnect();
      masterGain.disconnect();
      delayNode.disconnect();
      delayFeedbackGain.disconnect();
      delayWetGain.disconnect();
      reverbPreDelay.disconnect();
      reverbConvolver.disconnect();
      reverbToneFilter.disconnect();
      reverbWetGain.disconnect();
    },
  };
}
