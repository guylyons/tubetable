import { Copy, Music2, Trash2 } from "lucide-react";
import { formatSessionSummary } from "../lib/mixChannels";
import { deriveMixName } from "../lib/mixNaming";
import type { SavedMix } from "../types";
import { Menu } from "./Menu";
import { eyebrowClassName, panelClassName } from "./ui";

type SessionsPanelProps = {
  anyPlaying: boolean;
  currentMixKey: string;
  onDelete: (mixKey: string) => void;
  onDuplicate: (mixKey: string) => void;
  onSelect: (mixKey: string) => void;
  savedMixes: SavedMix[];
};

export function sessionDisplayName(mix: Pick<SavedMix, "name" | "channels">) {
  return mix.name.trim() || deriveMixName(mix.channels);
}

export function SessionsPanel({
  anyPlaying,
  currentMixKey,
  onDelete,
  onDuplicate,
  onSelect,
  savedMixes,
}: SessionsPanelProps) {
  return (
    <section aria-labelledby="sessions-heading" className={`${panelClassName} p-3 sm:p-4`}>
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="sessions-heading" className={`${eyebrowClassName} text-sm text-ink-muted`}>
          Saved sessions
        </h2>
        <span className="text-sm text-ink-muted">
          {savedMixes.length} {savedMixes.length === 1 ? "session" : "sessions"}
        </span>
      </div>

      {savedMixes.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {savedMixes.map(mix => {
            const isCurrent = mix.id === currentMixKey;
            const name = sessionDisplayName(mix);
            const thumbnail = mix.channels[0]?.video.thumbnail;

            return (
              <li
                key={mix.id}
                className={`flex items-center gap-1 rounded-lg border p-1.5 transition ${
                  isCurrent ? "border-fg/60 bg-card-hover shadow-md" : "border-transparent bg-card hover:bg-card-hover"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(mix.id)}
                  aria-current={isCurrent ? "true" : undefined}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md text-left"
                >
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt=""
                      loading="lazy"
                      className="aspect-video w-24 shrink-0 rounded-md bg-black object-cover sm:w-28"
                    />
                  ) : (
                    <span className="grid aspect-video w-24 shrink-0 place-items-center rounded-md bg-well sm:w-28">
                      <Music2 size={20} aria-hidden="true" className="text-ink-muted" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{name}</span>
                      {isCurrent && anyPlaying ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-live" aria-label="Playing" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-muted">{formatSessionSummary(mix.channels)}</span>
                  </span>
                </button>
                <Menu
                  label={`${name} options`}
                  items={[
                    { label: "Duplicate", icon: Copy, onSelect: () => onDuplicate(mix.id) },
                    { label: "Delete", icon: Trash2, danger: true, onSelect: () => onDelete(mix.id) },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
          No saved sessions yet. Save this session to keep it here.
        </p>
      )}
    </section>
  );
}
