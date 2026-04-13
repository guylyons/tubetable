type MixControlPanelProps = {
  isDarkMode: boolean;
  generatedMixName: string;
  isSavedMix: boolean;
  mixTitle: string;
  onCreateNewMix: () => void;
  onStartFromBeginning: () => void;
  onSaveMix: () => void;
  onSetMixTitle: (value: string) => void;
  saveMessage: string | null;
};

export function MixControlPanel({
  isDarkMode,
  generatedMixName,
  isSavedMix,
  mixTitle,
  onCreateNewMix,
  onStartFromBeginning,
  onSaveMix,
  onSetMixTitle,
  saveMessage,
}: MixControlPanelProps) {
  return (
    <section className={`rounded-[32px] border p-5 sm:p-6 ${isDarkMode ? "border-slate-800 bg-slate-900 text-slate-100 shadow-black/20" : "border-slate-200 bg-white text-slate-900 shadow-sm"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Mix controls
          </p>
          <h2 className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-slate-50" : "text-slate-950"}`}>
            Current mix
          </h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
          {isSavedMix ? "Saved mix" : "Draft mix"}
        </span>
      </div>

      <p className={`mt-3 text-sm leading-6 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
        Name the current setup, save changes, or start a new draft without
        losing anything already in your library.
      </p>

      <div className="mt-5 space-y-3">
        <label className="block">
          <span className={`mb-2 block text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>Mix name</span>
          <input
            type="text"
            value={mixTitle}
            onChange={(event) => onSetMixTitle(event.target.value)}
            placeholder={generatedMixName}
            className={`min-w-0 w-full rounded-2xl border px-4 py-3 text-sm font-medium outline-none transition placeholder:text-slate-400 ${
              isDarkMode
                ? "border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-400 focus:bg-slate-950"
                : "border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-300 focus:bg-white"
            }`}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={onCreateNewMix}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              isDarkMode
                ? "border-slate-700 bg-slate-800 text-slate-200 hover:border-sky-400 hover:text-sky-200"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            Start a new mix
          </button>
          <button
            type="button"
            onClick={onStartFromBeginning}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              isDarkMode
                ? "border-slate-700 bg-slate-800 text-slate-200 hover:border-sky-400 hover:text-sky-200"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            Start from beginning
          </button>
          <button
            type="button"
            onClick={onSaveMix}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold text-white transition ${
              isDarkMode ? "bg-sky-500 hover:bg-sky-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isSavedMix ? "Save changes" : "Save mix"}
          </button>
        </div>
      </div>

      {saveMessage ? (
        <p className={`mt-3 text-sm ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}>{saveMessage}</p>
      ) : null}
    </section>
  );
}
