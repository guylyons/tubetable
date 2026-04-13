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
          Your mixes
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">Library</h2>
        <p className="text-sm leading-6 text-slate-600">
          Save a setup, then come back to it instantly.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {savedMixes.length > 0 ? (
          savedMixes.map((savedMix) => (
            <div
              key={savedMix.id}
              className={`relative block w-full rounded-2xl border px-4 py-3 text-left transition ${
                savedMix.id === currentMixKey
                  ? "border-blue-200 bg-blue-50"
                  : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/60"
              }`}
            >
              {savedMix.id === currentMixKey && transportPlaying ? (
                <span className="absolute right-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm">
                  Now Playing
                </span>
              ) : null}

              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onSelectMix(savedMix.id)}
                  className="min-w-0 flex-1 pr-12 text-left"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {savedMix.name || deriveMixName(savedMix.channels)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {savedMix.channels.length} tracks ·{" "}
                    {new Date(savedMix.updatedAt).toLocaleDateString()}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteMix(savedMix.id)}
                  className="mt-8 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Delete mix ${savedMix.name || deriveMixName(savedMix.channels)}`}
                  title="Delete mix"
                >
                  ×
                </button>
              </div>
            </div>
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
