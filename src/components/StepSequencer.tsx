import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type StepSequencerProps = {
  currentStepIndex: number | null;
  enabled: boolean;
  isDarkMode: boolean;
  onChangePattern: (nextPattern: boolean[]) => void;
  onToggleEnabled: () => void;
  pattern: boolean[];
  trackLabel: string;
};

type PaintState = {
  lastIndex: number;
  paintValue: boolean;
  pointerId: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function StepSequencer({
  currentStepIndex,
  enabled,
  isDarkMode,
  onChangePattern,
  onToggleEnabled,
  pattern,
  trackLabel,
}: StepSequencerProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const paintStateRef = useRef<PaintState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function getStepIndexFromClientX(clientX: number) {
    const element = gridRef.current;
    if (!element || pattern.length === 0) {
      return 0;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0) {
      return 0;
    }

    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return clamp(Math.floor(ratio * pattern.length), 0, pattern.length - 1);
  }

  function commitPattern(nextPattern: boolean[]) {
    onChangePattern(nextPattern);
  }

  function paintStep(stepIndex: number, paintValue: boolean) {
    if (pattern[stepIndex] === paintValue) {
      return;
    }

    const nextPattern = [...pattern];
    nextPattern[stepIndex] = paintValue;
    commitPattern(nextPattern);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (pattern.length === 0) {
      return;
    }

    const stepIndex = getStepIndexFromClientX(event.clientX);
    const paintValue = !pattern[stepIndex];
    paintStateRef.current = {
      lastIndex: stepIndex,
      paintValue,
      pointerId: event.pointerId,
    };
    setIsDragging(true);
    paintStep(stepIndex, paintValue);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const paintState = paintStateRef.current;
    if (!paintState || paintState.pointerId !== event.pointerId) {
      return;
    }

    const stepIndex = getStepIndexFromClientX(event.clientX);
    if (stepIndex === paintState.lastIndex) {
      return;
    }

    paintState.lastIndex = stepIndex;
    paintStep(stepIndex, paintState.paintValue);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const paintState = paintStateRef.current;
    if (paintState?.pointerId === event.pointerId) {
      paintStateRef.current = null;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  }

  function fillPattern(value: boolean) {
    commitPattern(Array.from({ length: pattern.length }, () => value));
  }

  return (
    <section
      className={`rounded-[18px] border px-3 py-3 ${
        isDarkMode
          ? "border-slate-800 bg-slate-950/60"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${
              isDarkMode ? "text-sky-300" : "text-blue-700"
            }`}
          >
            Step sequencer
          </p>
          <p
            className={`mt-0.5 text-[13px] leading-5 ${
              isDarkMode ? "text-slate-300" : "text-slate-600"
            }`}
          >
            Click-drag the cells to program 16 slices from the selected loop.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleEnabled}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
              enabled
                ? isDarkMode
                  ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
                  : "border-blue-200 bg-blue-50 text-blue-700"
                : isDarkMode
                  ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            {enabled ? "On" : "Off"}
          </button>
          <button
            type="button"
            onClick={() => fillPattern(true)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
              isDarkMode
                ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-sky-200"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => fillPattern(false)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
              isDarkMode
                ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-red-400 hover:text-red-300"
                : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:text-red-600"
            }`}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        ref={gridRef}
        className={`mt-3 grid gap-1.5 rounded-[14px] border p-2 ${
          isDarkMode
            ? "border-slate-800 bg-slate-950/90"
            : "border-slate-200 bg-white"
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="grid"
        aria-label={`${trackLabel} step sequencer`}
      >
        <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
          {pattern.map((_, index) => (
            <div
              key={`step-label-${index}`}
              className={`text-center text-[9px] font-semibold uppercase tracking-[0.14em] ${
                index % 4 === 0
                  ? isDarkMode
                    ? "text-slate-400"
                    : "text-slate-500"
                  : isDarkMode
                    ? "text-slate-500/70"
                    : "text-slate-400/80"
              }`}
            >
              {index + 1}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
          {pattern.map((active, index) => {
            const isCurrent = currentStepIndex === index;
            return (
              <button
                key={`step-${index}`}
                type="button"
                className={`aspect-square rounded-[6px] border transition ${
                  active
                    ? isDarkMode
                      ? "border-cyan-300/50 bg-cyan-300/85 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                      : "border-blue-400/50 bg-blue-500/85 shadow-[0_0_0_1px_rgba(37,99,235,0.20)]"
                    : isDarkMode
                      ? "border-slate-700 bg-slate-900/90"
                      : "border-slate-200 bg-slate-100"
                } ${
                  isCurrent
                    ? isDarkMode
                      ? "ring-2 ring-cyan-200 ring-offset-1 ring-offset-slate-950"
                      : "ring-2 ring-blue-400 ring-offset-1 ring-offset-white"
                    : ""
                } ${
                  isDragging ? "cursor-cell" : "cursor-pointer"
                }`}
                aria-pressed={active}
                aria-label={`Step ${index + 1}${active ? " on" : " off"}`}
              >
                <span
                  className={`block h-full w-full rounded-[5px] ${
                    active
                      ? isDarkMode
                        ? "bg-[linear-gradient(180deg,_rgba(255,255,255,0.18),_rgba(255,255,255,0))]"
                        : "bg-[linear-gradient(180deg,_rgba(255,255,255,0.18),_rgba(255,255,255,0))]"
                      : ""
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 px-0.5 pt-0.5">
          <p
            className={`text-[10px] leading-4 ${
              isDarkMode ? "text-slate-500" : "text-slate-500"
            }`}
          >
            Steps follow the selected loop from A to B.
          </p>
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            16 steps
          </p>
        </div>
      </div>
    </section>
  );
}
