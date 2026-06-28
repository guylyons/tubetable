# Lofi Lowpass Effect Notes

Goal: add only the `lofi` lowpass filter first. Keep it isolated from reverb, delay, diagnostics, proxy changes, or pitch-shift behavior until the simple path is stable.

## Minimal state

Add these track fields first:

```ts
lofiEnabled: boolean;
lofiCutoffHz: number;
```

Suggested defaults:

```ts
lofiEnabled: false;
lofiCutoffHz: 2400;
```

Keep storage tolerant of old mixes by defaulting missing values during load.

## Minimal audio graph

Inside the track audio controller, split the media source into dry and filtered paths:

```text
source -> dryGain -> mixGain -> masterGain -> destination
source -> lofiFilter -> lofiWetGain -> mixGain
```

Use one `BiquadFilterNode`:

```ts
lofiFilter.type = "lowpass";
lofiFilter.frequency.value = lofiCutoffHz;
lofiFilter.Q.value = 0.8;
```

For the first pass, avoid a mix slider. Treat the toggle as full wet/dry switching:

```ts
dryGain.gain.value = lofiEnabled ? 0 : 1;
lofiWetGain.gain.value = lofiEnabled ? 1 : 0;
lofiFilter.frequency.value = lofiEnabled ? lofiCutoffHz : 22050;
```

## UI

Add one toggle labeled `Lofi` and one cutoff slider. A reasonable range is `300` to `12000` Hz with a step of `50`.

Wire UI changes through the existing channel patch flow. Do not add new audio loading, server proxy, or diagnostics behavior for this effect.

## First checks

Add a focused test that verifies:

- new channels default `lofiEnabled` to `false`
- saved mixes without lofi fields still load
- enabling lofi updates only the lowpass filter and dry/wet gains

After that passes, test manually with one track playing and confirm the YouTube iframe still owns normal playback when lofi is off.
