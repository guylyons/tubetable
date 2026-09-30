import { deriveMixName } from "../lib/mixNaming";
import type { DeletedMix, SavedMix } from "../types";
import { headingClassName, mutedTextClassName, panelClassName } from "./ui";

type SavedMixesPanelProps = {
  currentMixKey: string;
  lastDeleted: DeletedMix | null;
  onDeleteMix: (mixKey: string) => void;
  onSelectMix: (mixKey: string) => void;
  onUndoDelete: () => void;
  savedMixes: SavedMix[];
  transportPlaying: boolean;
};

function displayName(mix: SavedMix) {
  return mix.name || deriveMixName(mix.channels);
}

export function SavedMixesPanel({
  currentMixKey,
  lastDeleted,
  onDeleteMix,
  onSelectMix,
  onUndoDelete,
  savedMixes,
  transportPlaying,
}: SavedMixesPanelProps) {
  return (
    <section className={panelClassName}>
      <h2 className={headingClassName}>Library</h2>

      {lastDeleted ? (
        <p
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm dark:bg-slate-800"
          role="status"
        >
          <span className="min-w-0 truncate">Deleted “{displayName(lastDeleted.mix)}”</span>
          <button
            type="button"
            onClick={onUndoDelete}
            className="shrink-0 cursor-pointer font-semibold text-blue-700 hover:underline dark:text-sky-300"
          >
            Undo
          </button>
        </p>
      ) : null}

      <div className={`mt-4 space-y-3 ${savedMixes.length > 6 ? "max-h-[36rem] overflow-y-auto pr-2" : ""}`}>
        {savedMixes.length > 0 ? (
          savedMixes.map(savedMix => {
            const isCurrent = savedMix.id === currentMixKey;

            return (
              <article
                key={savedMix.id}
                className={`relative rounded-2xl border transition ${
                  isCurrent
                    ? "border-blue-200 bg-blue-50 dark:border-sky-400/40 dark:bg-slate-800"
                    : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/60 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-sky-400/30 dark:hover:bg-slate-800/70"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectMix(savedMix.id)}
                  aria-current={isCurrent ? "true" : undefined}
                  className="block w-full cursor-pointer rounded-2xl px-4 py-3 pr-16 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-sky-400 dark:focus-visible:ring-offset-slate-900"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className="min-w-0 truncate">{displayName(savedMix)}</span>
                    {isCurrent && transportPlaying ? (
                      <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                        Playing
                      </span>
                    ) : null}
                  </span>
                  <span className={`mt-1 block text-xs ${mutedTextClassName}`}>
                    {savedMix.channels.length} videos · {new Date(savedMix.updatedAt).toLocaleDateString()}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteMix(savedMix.id)}
                  className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300 dark:focus-visible:ring-red-400 dark:focus-visible:ring-offset-slate-900"
                  aria-label={`Delete mix ${displayName(savedMix)}`}
                  title="Delete mix"
                >
                  ×
                </button>
              </article>
            );
          })
        ) : (
          <p
            className={`rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm dark:border-slate-700 ${mutedTextClassName}`}
          >
            No saved mixes yet.
          </p>
        )}
      </div>
    </section>
  );
}
