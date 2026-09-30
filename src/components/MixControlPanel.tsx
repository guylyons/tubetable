import {
  headingClassName,
  inputClassName,
  mutedTextClassName,
  panelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "./ui";

type MixControlPanelProps = {
  generatedMixName: string;
  isSavedMix: boolean;
  masterVolume: number;
  mixTitle: string;
  onChangeMasterVolume: (value: number) => void;
  onCreateNewMix: () => void;
  onResetChannelBalances: () => void;
  onSaveMix: () => void;
  onSetMixTitle: (value: string) => void;
  onStartFromBeginning: () => void;
  statusMessage: string | null;
};

export function MixControlPanel({
  generatedMixName,
  isSavedMix,
  masterVolume,
  mixTitle,
  onChangeMasterVolume,
  onCreateNewMix,
  onResetChannelBalances,
  onSaveMix,
  onSetMixTitle,
  onStartFromBeginning,
  statusMessage,
}: MixControlPanelProps) {
  return (
    <section className={`space-y-5 ${panelClassName}`}>
      <h2 className={headingClassName}>Current mix</h2>

      <label className="block">
        <span className={`mb-2 block text-sm ${mutedTextClassName}`}>Name</span>
        <input
          type="text"
          value={mixTitle}
          onChange={event => onSetMixTitle(event.target.value)}
          placeholder={generatedMixName}
          className={inputClassName}
        />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <label htmlFor="master-volume" className={mutedTextClassName}>
            Master volume <span className="tabular-nums">{masterVolume}%</span>
          </label>
          <button
            type="button"
            onClick={onResetChannelBalances}
            className="cursor-pointer text-blue-700 hover:underline dark:text-sky-300"
          >
            Reset track levels
          </button>
        </div>
        <input
          id="master-volume"
          type="range"
          min={0}
          max={100}
          value={masterVolume}
          onChange={event => onChangeMasterVolume(Number(event.target.value))}
          className="tubetable-slider h-2 w-full cursor-pointer appearance-none"
        />
      </div>

      <div className="grid auto-cols-fr grid-flow-col gap-3">
        <button type="button" onClick={onCreateNewMix} className={secondaryButtonClassName}>
          New mix
        </button>
        <button type="button" onClick={onStartFromBeginning} className={secondaryButtonClassName}>
          Restart
        </button>
        {isSavedMix ? null : (
          <button type="button" onClick={onSaveMix} className={primaryButtonClassName}>
            Save
          </button>
        )}
      </div>

      <p className={`text-sm ${mutedTextClassName}`} role="status">
        {statusMessage ?? (isSavedMix ? "Changes save automatically." : "Save this mix to keep it in your library.")}
      </p>
    </section>
  );
}
