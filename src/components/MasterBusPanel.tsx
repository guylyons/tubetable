import { getTransportLabel } from "../lib/mixChannels";

type MasterBusPanelProps = {
  isDarkMode: boolean;
  masterVolume: number;
  onChangeMasterVolume: (value: number) => void;
  onClearMix: () => void;
  onResetChannelBalances: () => void;
  onToggleTransport: () => void;
  transportPlaying: boolean;
};

export function MasterBusPanel({
  isDarkMode,
  masterVolume,
  onChangeMasterVolume,
  onResetChannelBalances,
}: MasterBusPanelProps) {
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
