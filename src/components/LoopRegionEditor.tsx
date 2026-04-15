import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { loadWaveformData, type WaveformData } from "../lib/waveformData";

type LoopRegionEditorProps = {
  currentTimeSeconds: number;
  durationSeconds: number | null;
  isDarkMode: boolean;
  isPlaying: boolean;
  loopEndSeconds: number | null;
  loopStartSeconds: number | null;
  onClearLoop: () => void;
  onSeek: (seconds: number) => void;
  onSetLoopEnd: (seconds: number) => void;
  onSetLoopStart: (seconds: number) => void;
  playbackRate: number;
  preferredStepSeconds?: number;
  trackLabel: string;
  waveformDataUrl: string;
};

type DragMode = "create" | "move" | "resize-start" | "resize-end";

type DragState = {
  mode: DragMode;
  originRatio: number;
  regionStartRatio: number;
  regionEndRatio: number;
  dragged: boolean;
  pointerId: number;
};

type SnapMarker = {
  ratio: number;
  strength: number;
  type: "transient" | "valley";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatClock(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "--:--";
  }

  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getDuration(durationSeconds: number | null, waveformData: WaveformData | null) {
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    return durationSeconds;
  }

  if (
    waveformData &&
    typeof waveformData.durationSeconds === "number" &&
    Number.isFinite(waveformData.durationSeconds) &&
    waveformData.durationSeconds > 0
  ) {
    return waveformData.durationSeconds;
  }

  return null;
}

function createFallbackWaveformData(durationSeconds: number | null): WaveformData {
  const effectiveDurationSeconds =
    typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : 180;
  const peaks = Array.from({ length: 1400 }, (_, index) => {
    const t = index / 1399;
    const drumPulse = Math.max(0, Math.sin(t * Math.PI * 16)) ** 1.8;
    const bed = 0.12 + 0.16 * Math.max(0, Math.sin(t * Math.PI * 4 + 0.3));
    const texture = 0.03 * Math.max(0, Math.sin(t * Math.PI * 40 + 1.7));
    return Math.max(0.05, Math.min(1, bed + drumPulse * 0.9 + texture));
  });

  return {
    durationSeconds: effectiveDurationSeconds,
    peaks,
  };
}

function getPercentile(values: number[], percentile: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(Math.round((sorted.length - 1) * percentile), 0, sorted.length - 1);
  return sorted[index] ?? 0;
}

function buildSnapMarkers(peaks: number[]) {
  if (peaks.length < 3) {
    return [] as SnapMarker[];
  }

  const peakFloor = Math.max(0.08, getPercentile(peaks, 0.78) * 0.7);
  const minSpacing = Math.max(6, Math.round(peaks.length / 90));
  const transientCandidates: Array<{ index: number; value: number }> = [];

  for (let index = 1; index < peaks.length - 1; index += 1) {
    const left = peaks[index - 1] ?? 0;
    const current = peaks[index] ?? 0;
    const right = peaks[index + 1] ?? 0;
    if (current >= left && current > right && current >= peakFloor) {
      transientCandidates.push({ index, value: current });
    }
  }

  transientCandidates.sort((a, b) => b.value - a.value);
  const chosenTransients: number[] = [];

  for (const candidate of transientCandidates) {
    if (
      chosenTransients.every(index => Math.abs(index - candidate.index) >= minSpacing)
    ) {
      chosenTransients.push(candidate.index);
    }
  }

  chosenTransients.sort((a, b) => a - b);

  const markers: SnapMarker[] = chosenTransients.map(index => ({
    ratio: index / Math.max(1, peaks.length - 1),
    strength: peaks[index] ?? 0,
    type: "transient",
  }));

  for (let index = 1; index < chosenTransients.length; index += 1) {
    const left = chosenTransients[index - 1];
    const right = chosenTransients[index];
    let valleyIndex = left;
    let valleyValue = peaks[left] ?? 1;

    for (let sampleIndex = left; sampleIndex <= right; sampleIndex += 1) {
      const value = peaks[sampleIndex] ?? 1;
      if (value < valleyValue) {
        valleyIndex = sampleIndex;
        valleyValue = value;
      }
    }

    markers.push({
      ratio: valleyIndex / Math.max(1, peaks.length - 1),
      strength: Math.max(0, 1 - valleyValue),
      type: "valley",
    });
  }

  return markers.sort((a, b) => a.ratio - b.ratio);
}

function snapRatioToMarker(ratio: number, markers: SnapMarker[]) {
  const normalizedRatio = clamp(ratio, 0, 1);
  if (markers.length === 0) {
    return normalizedRatio;
  }

  let bestTransient: SnapMarker | null = null;
  let bestValley: SnapMarker | null = null;

  for (const marker of markers) {
    const distance = Math.abs(marker.ratio - normalizedRatio);
    if (marker.type === "transient") {
      if (!bestTransient || distance < Math.abs(bestTransient.ratio - normalizedRatio)) {
        bestTransient = marker;
      }
    } else if (!bestValley || distance < Math.abs(bestValley.ratio - normalizedRatio)) {
      bestValley = marker;
    }
  }

  const transientDistance = bestTransient
    ? Math.abs(bestTransient.ratio - normalizedRatio)
    : Number.POSITIVE_INFINITY;
  const valleyDistance = bestValley
    ? Math.abs(bestValley.ratio - normalizedRatio)
    : Number.POSITIVE_INFINITY;

  const transientSnapRadius = 0.08;
  const valleySnapRadius = 0.045;

  if (bestTransient && transientDistance <= transientSnapRadius) {
    return bestTransient.ratio;
  }

  if (bestValley && valleyDistance <= valleySnapRadius) {
    return bestValley.ratio;
  }

  return normalizedRatio;
}

function getHandleMode(target: EventTarget | null): DragMode | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const handle = target.closest("[data-loop-handle]");
  if (!(handle instanceof HTMLElement)) {
    return null;
  }

  const value = handle.dataset.loopHandle;
  if (value === "start") {
    return "resize-start";
  }

  if (value === "end") {
    return "resize-end";
  }

  if (value === "move") {
    return "move";
  }

  return null;
}

export function LoopRegionEditor({
  currentTimeSeconds,
  durationSeconds,
  isDarkMode,
  isPlaying,
  loopEndSeconds,
  loopStartSeconds,
  onClearLoop,
  onSeek,
  onSetLoopEnd,
  onSetLoopStart,
  playbackRate,
  preferredStepSeconds,
  trackLabel,
  waveformDataUrl,
}: LoopRegionEditorProps) {
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [waveformZoom, setWaveformZoom] = useState(1);
  const [playheadPreviewSeconds, setPlayheadPreviewSeconds] =
    useState(currentTimeSeconds);
  const waveformRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const playheadFrameRef = useRef<number | null>(null);
  const playheadBaseRef = useRef({
    seconds: currentTimeSeconds,
    timestamp: performance.now(),
  });
  const snapMarkers = useMemo(
    () => buildSnapMarkers(waveformData?.peaks ?? []),
    [waveformData?.peaks],
  );
  const transientMarkers = snapMarkers.filter(marker => marker.type === "transient");
  const valleyMarkers = snapMarkers.filter(marker => marker.type === "valley");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    void loadWaveformData(waveformDataUrl)
      .then(nextWaveformData => {
        if (!cancelled) {
          setWaveformData(nextWaveformData);
        }
      })
      .catch(error => {
        if (!cancelled) {
          console.warn("[tubetable waveform] failed to load", waveformDataUrl, error);
          setWaveformData(createFallbackWaveformData(durationSeconds));
          setLoadError(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [durationSeconds, waveformDataUrl]);

  const effectiveDurationSeconds = getDuration(durationSeconds, waveformData);
  const peaks = waveformData?.peaks ?? [];
  const peakCount = peaks.length;
  const stepSizeSeconds = preferredStepSeconds ?? 0;
  const selectionReady =
    effectiveDurationSeconds !== null &&
    typeof loopStartSeconds === "number" &&
    Number.isFinite(loopStartSeconds) &&
    typeof loopEndSeconds === "number" &&
    Number.isFinite(loopEndSeconds) &&
    loopEndSeconds > loopStartSeconds;

  const loopStartRatio =
    selectionReady && effectiveDurationSeconds
      ? clamp(loopStartSeconds / effectiveDurationSeconds, 0, 1)
      : null;
  const loopEndRatio =
    selectionReady && effectiveDurationSeconds
      ? clamp(loopEndSeconds / effectiveDurationSeconds, 0, 1)
      : null;
  const safeDurationSeconds = effectiveDurationSeconds ?? 0;
  const safeLoopStartSeconds =
    typeof loopStartSeconds === "number" && Number.isFinite(loopStartSeconds)
      ? clamp(loopStartSeconds, 0, safeDurationSeconds)
      : 0;
  const safeLoopEndSeconds =
    typeof loopEndSeconds === "number" && Number.isFinite(loopEndSeconds)
      ? clamp(loopEndSeconds, 0, safeDurationSeconds)
      : 0;
  const playheadRatio =
    effectiveDurationSeconds !== null && effectiveDurationSeconds > 0
      ? clamp(playheadPreviewSeconds / effectiveDurationSeconds, 0, 1)
      : 0;
  const zoomLevel = clamp(waveformZoom, 1, 8);
  const zoomSpan = zoomLevel > 1 ? 1 / zoomLevel : 1;
  const zoomCenterRatio =
    loopStartRatio !== null && loopEndRatio !== null
      ? (loopStartRatio + loopEndRatio) / 2
      : playheadRatio;
  const zoomStartRatio =
    zoomSpan >= 1
      ? 0
      : clamp(zoomCenterRatio - zoomSpan / 2, 0, 1 - zoomSpan);

  function toDisplayRatio(globalRatio: number) {
    if (zoomSpan >= 1) {
      return clamp(globalRatio, 0, 1);
    }

    return clamp((globalRatio - zoomStartRatio) / zoomSpan, 0, 1);
  }

  function toGlobalRatio(displayRatio: number) {
    if (zoomSpan >= 1) {
      return clamp(displayRatio, 0, 1);
    }

    return clamp(zoomStartRatio + displayRatio * zoomSpan, 0, 1);
  }

  const loopStartDisplayRatio =
    loopStartRatio !== null ? toDisplayRatio(loopStartRatio) : null;
  const loopEndDisplayRatio =
    loopEndRatio !== null ? toDisplayRatio(loopEndRatio) : null;
  const playheadDisplayRatio = toDisplayRatio(playheadRatio);
  const visiblePeakStartIndex =
    peakCount > 0 && zoomSpan < 1
      ? Math.max(
          0,
          Math.floor(zoomStartRatio * Math.max(1, peakCount - 1)),
        )
      : 0;
  const visiblePeakEndIndex =
    peakCount > 0 && zoomSpan < 1
      ? Math.min(
          peakCount - 1,
          Math.ceil((zoomStartRatio + zoomSpan) * Math.max(1, peakCount - 1)),
        )
      : Math.max(0, peakCount - 1);
  const visiblePeaks =
    peakCount > 0
      ? peaks.slice(visiblePeakStartIndex, visiblePeakEndIndex + 1)
      : [];
  const visibleTransientMarkers = transientMarkers.filter((marker) => {
    if (zoomSpan >= 1) {
      return true;
    }

    return marker.ratio >= zoomStartRatio && marker.ratio <= zoomStartRatio + zoomSpan;
  });
  const visibleValleyMarkers = valleyMarkers.filter((marker) => {
    if (zoomSpan >= 1) {
      return true;
    }

    return marker.ratio >= zoomStartRatio && marker.ratio <= zoomStartRatio + zoomSpan;
  });

  function getRatioFromClientX(clientX: number) {
    const element = waveformRef.current;
    if (!element) {
      return 0;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0) {
      return 0;
    }

    return toGlobalRatio(clamp((clientX - rect.left) / rect.width, 0, 1));
  }

  useEffect(() => {
    playheadBaseRef.current = {
      seconds: currentTimeSeconds,
      timestamp: performance.now(),
    };
    setPlayheadPreviewSeconds(currentTimeSeconds);
  }, [currentTimeSeconds, playbackRate]);

  useEffect(() => {
    if (!isPlaying || effectiveDurationSeconds === null) {
      if (playheadFrameRef.current !== null) {
        cancelAnimationFrame(playheadFrameRef.current);
        playheadFrameRef.current = null;
      }
      return;
    }

    const tick = () => {
      const base = playheadBaseRef.current;
      const elapsedSeconds = (performance.now() - base.timestamp) / 1000;
      const nextSeconds = clamp(
        base.seconds + elapsedSeconds * playbackRate,
        0,
        effectiveDurationSeconds,
      );
      setPlayheadPreviewSeconds(nextSeconds);
      playheadFrameRef.current = requestAnimationFrame(tick);
    };

    playheadFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (playheadFrameRef.current !== null) {
        cancelAnimationFrame(playheadFrameRef.current);
        playheadFrameRef.current = null;
      }
    };
  }, [effectiveDurationSeconds, isPlaying, playbackRate]);

  function applyRegion(startRatio: number, endRatio: number, mode: DragMode) {
    if (!effectiveDurationSeconds) {
      return;
    }

    const normalizedStart = clamp(Math.min(startRatio, endRatio), 0, 1);
    const normalizedEnd = clamp(Math.max(startRatio, endRatio), 0, 1);
    if (normalizedEnd - normalizedStart < 0.002) {
      return;
    }

    let finalStart = normalizedStart;
    let finalEnd = normalizedEnd;

    if (mode === "move") {
      const width = normalizedEnd - normalizedStart;
      finalStart = snapRatioToMarker(normalizedStart, snapMarkers);
      finalEnd = finalStart + width;
      if (finalEnd > 1) {
        const overflow = finalEnd - 1;
        finalStart = Math.max(0, finalStart - overflow);
        finalEnd = 1;
      }
    } else if (mode === "resize-start") {
      finalStart = snapRatioToMarker(normalizedStart, snapMarkers);
      finalEnd = normalizedEnd;
    } else if (mode === "resize-end") {
      finalStart = normalizedStart;
      finalEnd = snapRatioToMarker(normalizedEnd, snapMarkers);
    } else {
      const snappedStart = snapRatioToMarker(normalizedStart, snapMarkers);
      const snappedEnd = snapRatioToMarker(normalizedEnd, snapMarkers);
      finalStart = Math.min(snappedStart, snappedEnd);
      finalEnd = Math.max(snappedStart, snappedEnd);
    }

    if (finalEnd - finalStart < 0.002) {
      return;
    }

    onSetLoopStart(finalStart * effectiveDurationSeconds);
    onSetLoopEnd(finalEnd * effectiveDurationSeconds);
  }

  function createSliceFromPlayhead() {
    if (!effectiveDurationSeconds || transientMarkers.length === 0) {
      const fallbackSpanSeconds = Math.min(0.5, (effectiveDurationSeconds ?? 0) * 0.1);
      const nextStart = Math.max(0, currentTimeSeconds - fallbackSpanSeconds / 2);
      const nextEnd = Math.min(
        effectiveDurationSeconds ?? currentTimeSeconds + fallbackSpanSeconds,
        currentTimeSeconds + fallbackSpanSeconds / 2,
      );
      onSetLoopStart(nextStart);
      onSetLoopEnd(Math.max(nextStart + 0.05, nextEnd));
      return;
    }

    const currentRatio = clamp(currentTimeSeconds / effectiveDurationSeconds, 0, 1);
    let previousTransient = transientMarkers[0];
    let nextTransient = transientMarkers[transientMarkers.length - 1];

    for (let index = 0; index < transientMarkers.length; index += 1) {
      const marker = transientMarkers[index];
      if (marker.ratio <= currentRatio) {
        previousTransient = marker;
      }
      if (marker.ratio >= currentRatio) {
        nextTransient = marker;
        break;
      }
    }

    const startSeconds = Math.min(previousTransient.ratio, nextTransient.ratio) * effectiveDurationSeconds;
    const endSeconds = Math.max(previousTransient.ratio, nextTransient.ratio) * effectiveDurationSeconds;

    if (endSeconds - startSeconds >= 0.05) {
      onSetLoopStart(startSeconds);
      onSetLoopEnd(endSeconds);
    }
  }

  function nudgeLoopToBeatGrid(direction: "start" | "end") {
    if (!effectiveDurationSeconds || !stepSizeSeconds) {
      return;
    }

    const step = stepSizeSeconds / 2;
    if (direction === "start") {
      const nextStart = Math.max(0, (loopStartSeconds ?? currentTimeSeconds) - step);
      onSetLoopStart(nextStart);
      return;
    }

    const nextEnd = Math.min(
      effectiveDurationSeconds,
      (loopEndSeconds ?? currentTimeSeconds) + step,
    );
    onSetLoopEnd(nextEnd);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!effectiveDurationSeconds) {
      return;
    }

    const handleMode = getHandleMode(event.target);
    const ratio = getRatioFromClientX(event.clientX);
    const handleWindow = 0.035;
    let mode: DragMode = handleMode ?? "create";

    if (!handleMode && loopStartRatio !== null && loopEndRatio !== null) {
      if (Math.abs(ratio - loopStartRatio) <= handleWindow) {
        mode = "resize-start";
      } else if (Math.abs(ratio - loopEndRatio) <= handleWindow) {
        mode = "resize-end";
      } else if (ratio > loopStartRatio && ratio < loopEndRatio) {
        mode = "move";
      }
    }

    dragStateRef.current = {
      mode,
      originRatio: ratio,
      regionStartRatio: loopStartRatio ?? ratio,
      regionEndRatio: loopEndRatio ?? ratio,
      dragged: false,
      pointerId: event.pointerId,
    };
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();

    if (mode === "create") {
      applyRegion(ratio, Math.min(1, ratio + 0.01), "create");
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || !effectiveDurationSeconds) {
      return;
    }

    const ratio = getRatioFromClientX(event.clientX);
    if (Math.abs(ratio - dragState.originRatio) > 0.002) {
      dragState.dragged = true;
      suppressClickRef.current = true;
    }

    if (dragState.mode === "create") {
      applyRegion(dragState.originRatio, ratio, "create");
      return;
    }

    if (dragState.mode === "resize-start") {
      applyRegion(ratio, dragState.regionEndRatio, "resize-start");
      return;
    }

    if (dragState.mode === "resize-end") {
      applyRegion(dragState.regionStartRatio, ratio, "resize-end");
      return;
    }

    const regionWidth = dragState.regionEndRatio - dragState.regionStartRatio;
    const offset = ratio - dragState.originRatio;
    const nextStart = clamp(dragState.regionStartRatio + offset, 0, 1 - regionWidth);
    applyRegion(nextStart, nextStart + regionWidth, "move");
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (dragState?.pointerId === event.pointerId) {
      dragStateRef.current = null;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleWaveformClick(event: ReactPointerEvent<HTMLDivElement>) {
    if (!effectiveDurationSeconds) {
      return;
    }

    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    const ratio = getRatioFromClientX(event.clientX);
    onSeek(ratio * effectiveDurationSeconds);
  }

  return (
    <section
      className={`overflow-hidden rounded-[22px] border shadow-sm ${
        isDarkMode
          ? "border-slate-800 bg-slate-950/65"
          : "border-slate-200 bg-white"
      }`}
    >
      <div
        className={`border-b px-3 py-3 ${
          isDarkMode ? "border-slate-800" : "border-slate-100"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${
                isDarkMode ? "text-sky-300" : "text-blue-700"
              }`}
            >
              Clip loop
            </p>
            <p
              className={`mt-0.5 text-[12px] leading-5 ${
                isDarkMode ? "text-slate-300" : "text-slate-600"
              }`}
            >
              Drag the brace, grab A or B, or slice at the playhead.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                isDarkMode
                  ? "bg-slate-900/90 text-slate-300"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {selectionReady ? "Loop active" : "Drag to select"}
            </div>
            <button
              type="button"
              onClick={() => setWaveformZoom(1)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                isDarkMode
                  ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
              }`}
            >
              Fit
            </button>
            <button
              type="button"
              onClick={() => setWaveformZoom((value) => clamp(value - 0.5, 1, 8))}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                isDarkMode
                  ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
              }`}
              aria-label="Zoom out waveform"
            >
              -
            </button>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                isDarkMode
                  ? "bg-slate-900/90 text-slate-300"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {zoomLevel.toFixed(2)}x
            </span>
            <button
              type="button"
              onClick={() => setWaveformZoom((value) => clamp(value + 0.5, 1, 8))}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                isDarkMode
                  ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
              }`}
              aria-label="Zoom in waveform"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 py-3">
        <div
          ref={waveformRef}
          className={`group relative cursor-crosshair touch-none select-none overflow-hidden rounded-[18px] border px-2 py-2 ${
            isDarkMode
              ? "border-slate-800 bg-[linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(15,23,42,0.82))]"
              : "border-slate-200 bg-[linear-gradient(180deg,_rgba(248,250,252,0.98),_rgba(255,255,255,0.96))]"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleWaveformClick}
          role="button"
          tabIndex={0}
          aria-label={`Waveform for ${trackLabel}. Drag to create or adjust a loop region.`}
        >
          <div className="pointer-events-none absolute inset-0 z-10">
            {selectionReady &&
            loopStartDisplayRatio !== null &&
            loopEndDisplayRatio !== null ? (
              <div
                className={`absolute inset-y-3 rounded-[18px] border-2 ${
                  isDarkMode
                    ? "border-cyan-300/80 bg-cyan-300/18 shadow-[0_0_30px_rgba(34,211,238,0.16)]"
                    : "border-blue-500/70 bg-blue-500/16 shadow-[0_0_30px_rgba(37,99,235,0.18)]"
                }`}
                style={{
                  left: `${loopStartDisplayRatio * 100}%`,
                  width: `${(loopEndDisplayRatio - loopStartDisplayRatio) * 100}%`,
                }}
              />
            ) : null}

            <div
              className={`absolute inset-y-2 w-0.5 ${
                isDarkMode ? "bg-sky-300/90" : "bg-blue-600/90"
              }`}
              style={{ left: `${playheadDisplayRatio * 100}%` }}
            />
          </div>

          {selectionReady &&
          loopStartDisplayRatio !== null &&
          loopEndDisplayRatio !== null ? (
            <div className="absolute inset-0 z-20">
              <div
                data-loop-handle="start"
                className="absolute inset-y-1 z-30 w-10 -translate-x-1/2 cursor-ew-resize"
                style={{ left: `${loopStartDisplayRatio * 100}%` }}
                aria-hidden="true"
              />
              <div
                data-loop-handle="move"
                className="absolute inset-y-2 z-20 cursor-grab"
                style={{
                  left: `${loopStartDisplayRatio * 100}%`,
                  width: `${Math.max(0, (loopEndDisplayRatio - loopStartDisplayRatio) * 100)}%`,
                }}
                aria-hidden="true"
              />
              <div
                data-loop-handle="end"
                className="absolute inset-y-1 z-30 w-10 -translate-x-1/2 cursor-ew-resize"
                style={{ left: `${loopEndDisplayRatio * 100}%` }}
                aria-hidden="true"
              />
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-0 z-[5]">
            {Array.from({ length: 15 }).map((_, index) => {
              const ratio = index / 14;
              const major = index % 4 === 0;
              const displayRatio = toDisplayRatio(ratio);
              if (zoomSpan < 1 && (ratio < zoomStartRatio || ratio > zoomStartRatio + zoomSpan)) {
                return null;
              }
              return (
                <div
                  key={`grid-${index}`}
                  className={`absolute inset-y-1 ${major ? "w-px" : "w-px opacity-40"}`}
                  style={{
                    left: `${displayRatio * 100}%`,
                    backgroundColor: major
                      ? isDarkMode
                        ? "rgba(148,163,184,0.22)"
                        : "rgba(148,163,184,0.28)"
                      : isDarkMode
                        ? "rgba(148,163,184,0.10)"
                        : "rgba(148,163,184,0.14)",
                  }}
                />
              );
            })}
            {visibleValleyMarkers.map(marker => (
              <div
                key={`valley-${marker.ratio.toFixed(4)}`}
                className="absolute inset-y-5 w-px opacity-35"
                style={{
                  left: `${toDisplayRatio(marker.ratio) * 100}%`,
                  background: isDarkMode
                    ? "linear-gradient(180deg, rgba(148,163,184,0), rgba(148,163,184,0.6), rgba(148,163,184,0))"
                    : "linear-gradient(180deg, rgba(148,163,184,0), rgba(100,116,139,0.55), rgba(148,163,184,0))",
                }}
              />
            ))}
            {visibleTransientMarkers.map(marker => {
              const insideLoop =
                loopStartRatio !== null &&
                loopEndRatio !== null &&
                marker.ratio >= loopStartRatio &&
                marker.ratio <= loopEndRatio;
              return (
                <div
                  key={`transient-${marker.ratio.toFixed(4)}`}
                  className="absolute inset-y-2 flex w-0 -translate-x-1/2 items-center justify-center"
                  style={{ left: `${toDisplayRatio(marker.ratio) * 100}%` }}
                >
                  <div
                    className={`w-[2px] rounded-full ${
                      insideLoop
                        ? isDarkMode
                          ? "bg-cyan-200"
                          : "bg-blue-600"
                        : isDarkMode
                          ? "bg-cyan-300/70"
                          : "bg-blue-500/55"
                    }`}
                    style={{
                      height: `${Math.max(22, Math.round(18 + marker.strength * 72))}px`,
                      boxShadow: insideLoop
                        ? isDarkMode
                          ? "0 0 18px rgba(34,211,238,0.35)"
                          : "0 0 18px rgba(37,99,235,0.28)"
                        : "none",
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div
            className={`pointer-events-none absolute inset-x-2 top-1/2 z-0 h-px -translate-y-1/2 ${
              isDarkMode ? "bg-slate-600/45" : "bg-slate-300/90"
            }`}
          />

          {(!waveformData || peakCount === 0) && !isLoading ? (
            <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center">
              <div
                className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                  isDarkMode
                    ? "border-slate-700 bg-slate-950/95 text-slate-300"
                    : "border-slate-200 bg-white/95 text-slate-600"
                }`}
              >
                Waveform unavailable, using clip controls only
              </div>
            </div>
          ) : null}

          <div
            className="relative z-0 grid h-28 items-end overflow-hidden rounded-[16px] px-0.5 py-1.5"
            style={{
              gridTemplateColumns:
                visiblePeaks.length > 0
                  ? `repeat(${visiblePeaks.length}, minmax(0, 1fr))`
                  : undefined,
            }}
          >
            {visiblePeaks.length > 0
              ? visiblePeaks.map((peak, index) => {
                  const globalIndex = visiblePeakStartIndex + index;
                  const ratio =
                    peakCount > 1 ? globalIndex / (peakCount - 1) : 0;
                  const inLoop =
                    loopStartRatio !== null &&
                    loopEndRatio !== null &&
                    ratio >= loopStartRatio &&
                    ratio <= loopEndRatio;

                  return (
                    <div
                      key={`${trackLabel}-peak-${index}`}
                      className="relative h-full rounded-full"
                    >
                      <div
                        className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full transition-colors ${
                          inLoop
                            ? isDarkMode
                              ? "bg-cyan-300"
                              : "bg-blue-600"
                          : isDarkMode
                              ? "bg-slate-600"
                              : "bg-slate-300"
                        }`}
                        style={{
                          height: `${Math.max(8, Math.round(peak * 100))}%`,
                          opacity: inLoop ? 1 : 0.92,
                        }}
                      />
                    </div>
                  );
                })
              : null}

            {isLoading ? (
              <div
                className={`absolute inset-0 grid place-items-center text-sm ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Fetching full waveform...
              </div>
            ) : null}

            {!isLoading && loadError ? (
              <div
                className={`absolute inset-0 grid place-items-center text-sm ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {loadError}
              </div>
            ) : null}
          </div>

          {selectionReady && loopStartRatio !== null && loopEndRatio !== null ? (
            <>
              <div
                data-loop-handle="start"
                className="absolute inset-y-0 z-20 flex w-10 -translate-x-1/2 cursor-ew-resize items-center justify-center touch-none select-none"
                style={{ left: `${loopStartDisplayRatio * 100}%` }}
              >
                <div
                  className={`flex h-16 w-6 items-start justify-center rounded-full border shadow-sm ${
                    isDarkMode
                      ? "border-cyan-100/70 bg-cyan-300/90"
                      : "border-white bg-blue-600/90"
                  }`}
                >
                  <span
                    className={`mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] ${
                      isDarkMode ? "bg-slate-950 text-cyan-100" : "bg-white text-blue-700"
                    }`}
                  >
                    A
                  </span>
                </div>
              </div>
              <div
                data-loop-handle="end"
                className="absolute inset-y-0 z-20 flex w-10 -translate-x-1/2 cursor-ew-resize items-center justify-center touch-none select-none"
                style={{ left: `${loopEndDisplayRatio * 100}%` }}
              >
                <div
                  className={`flex h-16 w-6 items-start justify-center rounded-full border shadow-sm ${
                    isDarkMode
                      ? "border-cyan-100/70 bg-cyan-300/90"
                      : "border-white bg-blue-600/90"
                  }`}
                >
                  <span
                    className={`mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] ${
                      isDarkMode ? "bg-slate-950 text-cyan-100" : "bg-white text-blue-700"
                    }`}
                  >
                    B
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
          <span
            className={`font-semibold uppercase tracking-[0.16em] ${
              isDarkMode ? "text-slate-500" : "text-slate-500"
            }`}
          >
            0:00
          </span>
          <span
            className={`font-semibold uppercase tracking-[0.16em] ${
              isDarkMode ? "text-slate-500" : "text-slate-500"
            }`}
          >
            {formatClock(effectiveDurationSeconds)}
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div
            className={`rounded-[18px] border px-3 py-3 ${
              isDarkMode
                ? "border-slate-800 bg-slate-950/60"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  A
                </p>
                <p
                  className={`mt-0.5 text-[13px] font-semibold ${
                    isDarkMode ? "text-slate-100" : "text-slate-900"
                  }`}
                >
                  {formatClock(loopStartSeconds)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextSeconds =
                    typeof loopEndSeconds === "number" &&
                    currentTimeSeconds >= loopEndSeconds
                      ? Math.max(0, loopEndSeconds - 0.01)
                      : currentTimeSeconds;
                  onSetLoopStart(nextSeconds);
                }}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                  isDarkMode
                    ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400 hover:text-sky-200"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
                }`}
              >
                Set
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(safeLoopEndSeconds, safeLoopStartSeconds, safeDurationSeconds)}
              step={0.01}
              value={safeLoopStartSeconds}
              onChange={event => onSetLoopStart(Number(event.target.value))}
              className="tubetable-slider mt-2 h-2 w-full cursor-pointer appearance-none"
              aria-label={`${trackLabel} loop start`}
            />
          </div>

          <div
            className={`rounded-[18px] border px-3 py-3 ${
              isDarkMode
                ? "border-slate-800 bg-slate-950/60"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  B
                </p>
                <p
                  className={`mt-0.5 text-[13px] font-semibold ${
                    isDarkMode ? "text-slate-100" : "text-slate-900"
                  }`}
                >
                  {formatClock(loopEndSeconds)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextSeconds =
                    typeof loopStartSeconds === "number" &&
                    currentTimeSeconds <= loopStartSeconds
                      ? loopStartSeconds + 0.01
                      : currentTimeSeconds;
                  onSetLoopEnd(
                    effectiveDurationSeconds
                      ? Math.min(effectiveDurationSeconds, nextSeconds)
                      : nextSeconds,
                  );
                }}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                  isDarkMode
                    ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400 hover:text-sky-200"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
                }`}
              >
                Set
              </button>
            </div>
            <input
              type="range"
              min={Math.min(safeLoopStartSeconds, safeLoopEndSeconds, safeDurationSeconds)}
              max={safeDurationSeconds}
              step={0.01}
              value={safeLoopEndSeconds}
              onChange={event => onSetLoopEnd(Number(event.target.value))}
              className="tubetable-slider mt-2 h-2 w-full cursor-pointer appearance-none"
              aria-label={`${trackLabel} loop end`}
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p
            className={`text-[11px] leading-5 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {selectionReady
              ? `Looping ${formatClock(loopStartSeconds)} to ${formatClock(loopEndSeconds)}. Peaks and valleys are loaded for the full track.`
              : "Drag across the waveform to define the loop. The full track waveform is prefetched and cached."}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={createSliceFromPlayhead}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                isDarkMode
                  ? "border-sky-500/40 bg-slate-900 text-sky-200 hover:border-sky-400 hover:text-sky-100"
                  : "border-blue-200 bg-white text-blue-700 hover:border-blue-300 hover:text-blue-800"
              }`}
            >
              Slice at playhead
            </button>
            <button
              type="button"
              onClick={onClearLoop}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                isDarkMode
                  ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-red-400 hover:text-red-300"
                  : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:text-red-600"
              }`}
            >
              Clear loop points
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
