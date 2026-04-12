import { getTransportLabel } from "../lib/mixChannels";

type MasterBusPanelProps = {
  masterVolume: number;
  onChangeMasterVolume: (value: number) => void;
  onClearMix: () => void;
  onResetChannelBalances: () => void;
  onToggleTransport: () => void;
  transportPlaying: boolean;
};

export function MasterBusPanel({
  masterVolume,
  onChangeMasterVolume,
  onClearMix,
  onResetChannelBalances,
  onToggleTransport,
  transportPlaying,
}: MasterBusPanelProps) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Master bus
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Room balance
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
          {masterVolume}%
        </span>
      </div>

      <div className="mt-5 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm text-slate-600">
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
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
          >
            Reset channel balances
          </button>
        </div>
      </div>
    </section>
  );
}
