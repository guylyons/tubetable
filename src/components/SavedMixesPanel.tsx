import { deriveMixName } from "../lib/mixNaming";
import type { SavedMix } from "../types";

type SavedMixesPanelProps = {
  currentMixKey: string;
  onSelectMix: (mixKey: string) => void;
  savedMixes: SavedMix[];
};

export function SavedMixesPanel({ currentMixKey, onSelectMix, savedMixes }: SavedMixesPanelProps) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Saved mixes</p>
        <h2 className="text-2xl font-semibold text-slate-950">Library</h2>
        <p className="text-sm leading-6 text-slate-600">Save a setup, then come back to it instantly.</p>
      </div>

      <div className="mt-5 space-y-3">
        {savedMixes.length > 0 ? (
          savedMixes.map(savedMix => (
            <button
              key={savedMix.id}
              type="button"
              onClick={() => onSelectMix(savedMix.id)}
              className={`block w-full rounded-2xl border px-4 py-3 text-left transition ${
                savedMix.id === currentMixKey
                  ? "border-blue-200 bg-blue-50"
                  : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/60"
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{savedMix.name || deriveMixName(savedMix.channels)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {savedMix.channels.length} tracks · {new Date(savedMix.updatedAt).toLocaleDateString()}
              </p>
            </button>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No saved mixes yet.
          </div>
        )}
      </div>
    </section>
  );
}
