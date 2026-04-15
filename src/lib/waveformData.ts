export type WaveformData = {
  durationSeconds: number;
  peaks: number[];
};

const waveformDataCache = new Map<string, Promise<WaveformData>>();

export async function loadWaveformData(waveformDataUrl: string) {
  const cached = waveformDataCache.get(waveformDataUrl);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    try {
      const response = await fetch(waveformDataUrl);
      if (!response.ok) {
        throw new Error("Could not load waveform data.");
      }

      const payload = (await response.json()) as Partial<WaveformData>;
      if (
        typeof payload.durationSeconds !== "number" ||
        !Number.isFinite(payload.durationSeconds) ||
        !Array.isArray(payload.peaks)
      ) {
        throw new Error("Waveform response was invalid.");
      }

      return {
        durationSeconds: payload.durationSeconds,
        peaks: payload.peaks
          .map(value =>
            typeof value === "number" && Number.isFinite(value) ? value : 0,
          )
          .map(value => Math.max(0, Math.min(1, value))),
      } satisfies WaveformData;
    } catch (error) {
      waveformDataCache.delete(waveformDataUrl);
      throw error;
    }
  })();

  waveformDataCache.set(waveformDataUrl, promise);
  return promise;
}

export function prefetchWaveformData(waveformDataUrl: string) {
  void loadWaveformData(waveformDataUrl).catch(() => {
    waveformDataCache.delete(waveformDataUrl);
  });
}
