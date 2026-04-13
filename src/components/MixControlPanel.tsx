type MixControlPanelProps = {
  generatedMixName: string;
  isSavedMix: boolean;
  mixTitle: string;
  onCreateNewMix: () => void;
  onSaveMix: () => void;
  onSetMixTitle: (value: string) => void;
  saveMessage: string | null;
};

export function MixControlPanel({
  generatedMixName,
  isSavedMix,
  mixTitle,
  onCreateNewMix,
  onSaveMix,
  onSetMixTitle,
  saveMessage,
}: MixControlPanelProps) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Mix controls
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Current mix
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {isSavedMix ? "Saved mix" : "Draft mix"}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        Name the current setup, save changes, or start a new draft without
        losing anything already in your library.
      </p>

      <div className="mt-5 space-y-3">
        <label className="block">
          <span className="mb-2 block text-sm text-slate-600">Mix name</span>
          <input
            type="text"
            value={mixTitle}
            onChange={(event) => onSetMixTitle(event.target.value)}
            placeholder={generatedMixName}
            className="min-w-0 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCreateNewMix}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
          >
            Start a new mix
          </button>
          <button
            type="button"
            onClick={onSaveMix}
            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {isSavedMix ? "Save changes" : "Save mix"}
          </button>
        </div>
      </div>

      {saveMessage ? (
        <p className="mt-3 text-sm text-blue-700">{saveMessage}</p>
      ) : null}
    </section>
  );
}
