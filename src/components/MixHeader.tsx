import { deriveMixName } from "../lib/mixNaming";
import { getTransportLabel } from "../lib/mixChannels";
import { DRAFT_MIX_KEY, MAX_CHANNELS, type SavedMix } from "../types";

type MixHeaderProps = {
  audibleChannels: number;
  channelsCount: number;
  currentMixKey: string;
  generatedMixName: string;
  isSavedMix: boolean;
  mixName: string;
  mixTitle: string;
  onCreateNewMix: () => void;
  onSaveMix: () => void;
  onSelectMix: (mixKey: string) => void;
  onSetMixTitle: (value: string) => void;
  onToggleTransport: () => void;
  saveMessage: string | null;
  savedMixes: SavedMix[];
  transportPlaying: boolean;
};

export function MixHeader({
  audibleChannels,
  channelsCount,
  currentMixKey,
  generatedMixName,
  isSavedMix,
  mixName,
  mixTitle,
  onCreateNewMix,
  onSaveMix,
  onSelectMix,
  onSetMixTitle,
  onToggleTransport,
  saveMessage,
  savedMixes,
  transportPlaying,
}: MixHeaderProps) {
  return (
    <header className="grid gap-8 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[minmax(0,1.25fr)_340px] lg:p-8">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Tubetable
          </div>
          <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {isSavedMix ? "Saved mix" : "Draft mix"}
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Build your own layered ambient mix.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Search YouTube, add up to five channels, and balance them in one clean workspace with simple blue
            controls.
          </p>

          <div className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={currentMixKey}
              onChange={event => onSelectMix(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-300"
            >
              <option value={DRAFT_MIX_KEY}>Draft mix</option>
              {savedMixes.map(savedMix => (
                <option key={savedMix.id} value={savedMix.id}>
                  {savedMix.name || deriveMixName(savedMix.channels)}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={mixTitle}
              onChange={event => onSetMixTitle(event.target.value)}
              placeholder={generatedMixName}
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white"
            />

            <button
              type="button"
              onClick={onSaveMix}
              className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {isSavedMix ? "Save changes" : "Save mix"}
            </button>

            <button
              type="button"
              onClick={onCreateNewMix}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
            >
              New mix
            </button>
          </div>

          <p className="text-sm font-medium text-blue-700">
            Current mix: {mixName}
            {saveMessage ? <span className="ml-3 text-slate-500">{saveMessage}</span> : null}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Channels</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {channelsCount}
            <span className="ml-2 text-base text-slate-400">/ {MAX_CHANNELS}</span>
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Live Now</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{audibleChannels}</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Transport</p>
          <button
            type="button"
            onClick={onToggleTransport}
            className="mt-3 inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            {getTransportLabel(transportPlaying)}
          </button>
        </div>
      </div>
    </header>
  );
}
