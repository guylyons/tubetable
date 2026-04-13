import { deriveMixName } from "../lib/mixNaming";
import type { SavedMix } from "../types";

type SavedMixesPanelProps = {
  currentMixKey: string;
  onDeleteMix: (mixKey: string) => void;
  onSelectMix: (mixKey: string) => void;
  savedMixes: SavedMix[];
  transportPlaying: boolean;
};

export function SavedMixesPanel({
  currentMixKey,
  onDeleteMix,
  onSelectMix,
  savedMixes,
  transportPlaying,
}: SavedMixesPanelProps) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          Saved mixes
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">Library</h2>
        <p className="text-sm leading-6 text-slate-600">
          Select a saved mix to load it instantly.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {savedMixes.length > 0 ? (
          savedMixes.map((savedMix) => (
            <article
              key={savedMix.id}
              className={`relative rounded-2xl border transition ${
                savedMix.id === currentMixKey
                  ? "border-blue-200 bg-blue-50"
                  : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/60"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectMix(savedMix.id)}
                className="block w-full cursor-pointer rounded-2xl px-4 py-3 pr-16 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {savedMix.name || deriveMixName(savedMix.channels)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {savedMix.channels.length} channels ·{" "}
                  {new Date(savedMix.updatedAt).toLocaleDateString()}
                </p>
              </button>

              {savedMix.id === currentMixKey && transportPlaying ? (
                <span className="absolute -top-[13px] right-0 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm">
                  Playing
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => onDeleteMix(savedMix.id)}
                className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                aria-label={`Delete mix ${savedMix.name || deriveMixName(savedMix.channels)}`}
                title="Delete mix"
              >
                ×
              </button>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No saved mixes yet. Save the current mix to add one.
          </div>
        )}
      </div>
    </section>
  );
}
