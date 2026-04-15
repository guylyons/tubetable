import { useEffect, useState } from "react";
import { getTransportLabel } from "../lib/mixChannels";

type MasterBusPanelProps = {
  isDarkMode: boolean;
  masterVolume: number;
  onChangeMasterVolume: (value: number) => void;
  onClearMix: () => void;
  onResetChannelBalances: () => void;
  onTapTempo: () => void;
  onSetTapTempoBpm: (value: number | null) => void;
  tapTempoBpm: number | null;
  onToggleTransport: () => void;
  transportPlaying: boolean;
};

export function MasterBusPanel({
  isDarkMode,
  masterVolume,
  onChangeMasterVolume,
  onClearMix,
  onResetChannelBalances,
  onTapTempo,
  onSetTapTempoBpm,
  tapTempoBpm,
  onToggleTransport,
  transportPlaying,
}: MasterBusPanelProps) {
  const [gridTempoInput, setGridTempoInput] = useState(
    tapTempoBpm === null ? "" : String(tapTempoBpm),
  );

  useEffect(() => {
    setGridTempoInput(tapTempoBpm === null ? "" : String(tapTempoBpm));
  }, [tapTempoBpm]);

  function commitGridTempoInput() {
    const trimmedValue = gridTempoInput.trim();
    if (trimmedValue === "") {
      onSetTapTempoBpm(null);
      return;
    }

    const nextValue = Number(trimmedValue);
    if (!Number.isFinite(nextValue)) {
      setGridTempoInput(tapTempoBpm === null ? "" : String(tapTempoBpm));
      return;
    }

    onSetTapTempoBpm(Math.min(240, Math.max(40, Math.round(nextValue))));
  }

  return (
    <section className={`rounded-[32px] border p-5 sm:p-6 ${isDarkMode ? "border-slate-800 bg-slate-900 text-slate-100 shadow-black/20" : "border-slate-200 bg-white text-slate-900 shadow-sm"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Master bus
          </p>
          <h2 className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-slate-50" : "text-slate-950"}`}>
            Overall volume
          </h2>
          <p className={`mt-2 text-sm leading-6 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            Set the volume for the full mix.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
          {masterVolume}%
        </span>
      </div>

      <div className="mt-5 space-y-5">
        <div
          className={`rounded-2xl border p-4 ${isDarkMode ? "border-slate-700 bg-slate-800/70" : "border-slate-200 bg-slate-50"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Tap tempo
              </p>
              <p className={`mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                Tap along with the groove to set delay timing.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${isDarkMode ? "bg-slate-900 text-slate-300" : "bg-white text-slate-600"}`}>
              {tapTempoBpm ? `${tapTempoBpm} BPM` : "Tap twice"}
            </span>
          </div>
          <button
            type="button"
            onClick={onTapTempo}
            className={`mt-3 w-full rounded-2xl border px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] transition ${
              isDarkMode
                ? "border-slate-700 bg-slate-900 text-slate-100 hover:border-sky-400 hover:text-sky-200"
                : "border-slate-200 bg-white text-slate-800 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            Tap tempo
          </button>
          <label className="mt-3 block">
            <span
              className={`mb-2 block text-xs font-semibold uppercase tracking-[0.14em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
            >
              Grid BPM
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={gridTempoInput}
                onChange={(event) => setGridTempoInput(event.target.value)}
                onBlur={commitGridTempoInput}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                placeholder="Enter BPM"
                className={`min-w-0 flex-1 rounded-2xl border px-4 py-3 text-sm font-medium outline-none transition placeholder:text-slate-400 ${
                  isDarkMode
                    ? "border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-400 focus:bg-slate-950"
                    : "border-slate-200 bg-white text-slate-900 focus:border-blue-300 focus:bg-white"
                }`}
                aria-label="Manual grid BPM"
              />
              {tapTempoBpm !== null ? (
                <button
                  type="button"
                  onClick={() => onSetTapTempoBpm(null)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] transition ${
                    isDarkMode
                      ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-red-400 hover:text-red-300"
                      : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:text-red-600"
                  }`}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </label>
        </div>

        <label className="block">
          <span className={`mb-2 block text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            Master volume
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={masterVolume}
            onChange={(event) =>
              onChangeMasterVolume(Number(event.target.value))
            }
            className="tubetable-slider h-2 w-full cursor-pointer appearance-none"
          />
        </label>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={onResetChannelBalances}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              isDarkMode
                ? "border-slate-700 bg-slate-800 text-slate-200 hover:border-sky-400 hover:text-sky-200"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            Reset channel settings
          </button>
        </div>
      </div>
    </section>
  );
}
