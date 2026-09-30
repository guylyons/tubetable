import { Save } from "lucide-react";
import { MAX_CHANNELS } from "../types";
import { accentButtonClassName, eyebrowClassName } from "./ui";

type SessionHeaderProps = {
  channelCount: number;
  generatedName: string;
  isSaved: boolean;
  name: string;
  onRename: (name: string) => void;
  onSave: () => void;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function SessionHeader({ channelCount, generatedName, isSaved, name, onRename, onSave }: SessionHeaderProps) {
  const size = Math.max(8, (name || generatedName).length + 1);

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-1">
      <div className="min-w-0 flex-1">
        <p className={`${eyebrowClassName} text-fg-muted`}>Your session</p>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <input
            type="text"
            value={name}
            size={size}
            onChange={event => onRename(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" || event.key === "Escape") {
                event.currentTarget.blur();
              }
            }}
            placeholder={generatedName}
            aria-label="Session name"
            spellCheck={false}
            className="-mx-1.5 min-w-0 max-w-full rounded-md bg-transparent px-1.5 text-2xl font-bold tracking-tight text-fg outline-none transition placeholder:text-fg-muted hover:bg-white/8 focus:bg-black/15 focus-visible:outline-2 focus-visible:outline-focus"
          />
          {isSaved ? (
            <span className="inline-flex items-center gap-2 text-sm text-fg-muted" title="Changes save automatically">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-fg-muted" />
              Saved
            </span>
          ) : (
            <span className="inline-flex items-center gap-3 text-sm text-fg-muted">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="h-2 w-2 rounded-full border border-fg-muted" />
                Unsaved
              </span>
              <button type="button" onClick={onSave} className={`h-8 px-3 ${accentButtonClassName}`}>
                <Save size={15} aria-hidden="true" />
                Save session
              </button>
            </span>
          )}
        </div>
      </div>
      <p className={`${eyebrowClassName} pb-1.5 tabular-nums text-fg-muted`}>
        {pad(channelCount)} / {pad(MAX_CHANNELS)} channels
      </p>
    </div>
  );
}
