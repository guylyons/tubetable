import { Pause, Play } from "lucide-react";
import { accentButtonClassName } from "./ui";

type StatusBarProps = {
  channels: { id: string; color: string; isPlaying: boolean }[];
  onTogglePlayAll: () => void;
};

export function StatusBar({ channels, onTogglePlayAll }: StatusBarProps) {
  const playingCount = channels.filter(channel => channel.isPlaying).length;

  return (
    <footer className="border-t border-line bg-bar text-xs text-fg-muted">
      <div className="mx-auto flex max-w-[1760px] items-center gap-3 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {channels.map(channel => (
            <span
              key={channel.id}
              className={`h-2.5 w-2.5 rounded-full transition-opacity ${channel.isPlaying ? "opacity-100" : "opacity-40"}`}
              style={{ backgroundColor: channel.color }}
            />
          ))}
        </div>
        <p aria-live="polite">
          {channels.length} {channels.length === 1 ? "channel" : "channels"} • {playingCount} playing
        </p>
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
        <p className="hidden items-center gap-2 sm:flex">
          <kbd className="rounded border border-fg/25 px-1.5 py-0.5 font-sans">Space</kbd>
          Play / pause
        </p>
        {/* On narrow screens the master panel is far down the page, so the transport lives here too. */}
        {channels.length > 0 ? (
          <button type="button" onClick={onTogglePlayAll} className={`h-8 px-3 xl:hidden ${accentButtonClassName}`}>
            {playingCount > 0 ? (
              <Pause size={15} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={15} fill="currentColor" aria-hidden="true" />
            )}
            {playingCount > 0 ? "Pause all" : "Play all"}
          </button>
        ) : null}
      </div>
    </footer>
  );
}
