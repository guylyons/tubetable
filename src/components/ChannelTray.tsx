import { CircleDot, Headphones, Pause, Play, Plus, VolumeX } from "lucide-react";
import type { CSSProperties } from "react";
import { getChannelStatus, type ChannelStatus } from "../lib/mixChannels";
import { MAX_CHANNELS, type MixChannelState, type PlayerStatus } from "../types";
import { Menu, type MenuItem } from "./Menu";
import { PLAYER_SLOT_ATTRIBUTE } from "./PlayerLayer";
import { accentButtonClassName, toggleButtonClassName } from "./ui";

export type ChannelCardModel = {
  channel: MixChannelState;
  color: string;
  isOnStage: boolean;
  isPlaying: boolean;
  menuItems: MenuItem[];
  number: string;
  status: PlayerStatus | undefined;
};

type ChannelTrayProps = {
  cards: ChannelCardModel[];
  onAddChannel: () => void;
  onChangeVolume: (channelId: string, volume: number) => void;
  onFocus: (channelId: string) => void;
  onToggleMute: (channelId: string) => void;
  onTogglePlay: (channelId: string) => void;
  onToggleSolo: (channelId: string) => void;
};

const STATUS_DOT_CLASS: Record<ChannelStatus["tone"], string> = {
  live: "bg-live",
  idle: "bg-[#5d6166]",
  busy: "bg-amber-500 animate-pulse",
  error: "bg-danger",
};

function ChannelCard({
  card,
  onChangeVolume,
  onFocus,
  onToggleMute,
  onTogglePlay,
  onToggleSolo,
}: Omit<ChannelTrayProps, "cards" | "onAddChannel"> & { card: ChannelCardModel }) {
  const { channel, color, isOnStage, isPlaying, menuItems, number, status } = card;
  const channelStatus = getChannelStatus(status, channel);
  const label = `Channel ${number}`;

  return (
    <article
      aria-label={`${label}: ${channel.video.title}`}
      className="flex min-w-0 flex-col rounded-lg border border-line bg-card text-ink shadow-sm"
      style={{ "--channel": color } as CSSProperties}
    >
      <header className="flex h-10 items-center gap-2.5 rounded-t-[7px] bg-(--channel) pl-3 pr-1 text-[#1b1b1c]">
        <span className="text-lg font-semibold tabular-nums">{number}</span>
        <span aria-hidden="true" className="h-5 w-px bg-black/25" />
        <span className="truncate text-xs font-semibold uppercase tracking-wider">{label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs font-medium">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[channelStatus.tone]}`} />
          {channelStatus.label}
        </span>
        <Menu label={`${label} options`} items={menuItems} buttonClassName="hover:bg-black/10" />
      </header>

      <div className={`flex flex-1 flex-col gap-3 p-3 transition-opacity ${channel.silencedBy ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onFocus(channel.id)}
            aria-label={isOnStage ? `${label} is on stage` : `Put ${label} on stage`}
            className="relative aspect-video w-32 shrink-0 cursor-pointer overflow-hidden rounded-md bg-black bg-cover bg-center sm:w-36"
            style={{ backgroundImage: `url("${channel.video.thumbnail}")` }}
            {...(isOnStage ? {} : { [PLAYER_SLOT_ATTRIBUTE]: channel.id })}
          >
            {isOnStage ? (
              <span className="absolute inset-0 grid place-items-center bg-black/55 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white">
                On stage
              </span>
            ) : null}
          </button>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-semibold leading-snug" title={channel.video.title}>
              {channel.video.title}
            </p>
            <p className="mt-0.5 truncate text-sm text-ink-muted">by {channel.video.channelTitle}</p>
          </div>
          <button
            type="button"
            onClick={() => onTogglePlay(channel.id)}
            disabled={status === "error"}
            aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
            className={`h-11 w-11 shrink-0 ${accentButtonClassName}`}
          >
            {isPlaying ? (
              <Pause size={20} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={20} fill="currentColor" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={channel.volume}
            onChange={event => onChangeVolume(channel.id, Number(event.target.value))}
            aria-label={`${label} volume`}
            aria-valuetext={`${channel.volume}%`}
            className="tt-range flex-1"
            style={{ "--range-fill": `${channel.volume}%`, "--range-color": color } as CSSProperties}
          />
          <span className="w-10 text-right text-sm tabular-nums">{channel.volume}%</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-3 pb-3">
        <button
          type="button"
          onClick={() => onToggleMute(channel.id)}
          aria-pressed={channel.muted}
          aria-label={`Mute ${label}`}
          className={toggleButtonClassName(channel.muted)}
          style={{ "--pressed-bg": "var(--tt-ink)", "--pressed-ink": "var(--tt-card)" } as CSSProperties}
        >
          <VolumeX size={17} aria-hidden="true" />
          Mute
        </button>
        <button
          type="button"
          onClick={() => onToggleSolo(channel.id)}
          aria-pressed={channel.solo}
          aria-label={`Solo ${label}`}
          className={toggleButtonClassName(channel.solo)}
          style={{ "--pressed-bg": color, "--pressed-ink": "#1b1b1c" } as CSSProperties}
        >
          <Headphones size={17} aria-hidden="true" />
          Solo
        </button>
        <button
          type="button"
          onClick={() => onFocus(channel.id)}
          aria-pressed={isOnStage}
          aria-label={`Focus ${label}`}
          className={toggleButtonClassName(isOnStage)}
          style={{ "--pressed-bg": "var(--tt-accent)", "--pressed-ink": "var(--tt-accent-ink)" } as CSSProperties}
        >
          <CircleDot size={17} aria-hidden="true" />
          Focus
        </button>
      </div>
    </article>
  );
}

export function ChannelTray({ cards, onAddChannel, ...handlers }: ChannelTrayProps) {
  const canAdd = cards.length < MAX_CHANNELS;

  return (
    <section aria-label="Channels" className="rounded-xl border border-line bg-panel p-2 shadow-sm sm:p-3">
      <div className="grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] sm:gap-3">
        {cards.map(card => (
          <ChannelCard key={card.channel.id} card={card} {...handlers} />
        ))}
        {canAdd ? (
          <button
            type="button"
            onClick={onAddChannel}
            className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-ink/25 text-ink-muted transition hover:border-ink/45 hover:bg-card/40 hover:text-ink"
          >
            <Plus size={30} strokeWidth={1.75} aria-hidden="true" />
            <span className="text-base font-medium">Add channel</span>
            <span className="text-sm tabular-nums">
              {String(cards.length + 1).padStart(2, "0")} / {String(MAX_CHANNELS).padStart(2, "0")}
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
