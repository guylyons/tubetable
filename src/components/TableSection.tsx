import { useState } from "react";
import { VideoTile } from "./VideoTile";
import { headingClassName, primaryButtonClassName } from "./ui";
import { MAX_CHANNELS, type MixChannelState } from "../types";

type TableSectionProps = {
  channelStates: MixChannelState[];
  focusedChannelId: string | null;
  onChangeChannelVolume: (channelId: string, volume: number) => void;
  onFocusChannel: (channelId: string) => void;
  onReorderChannel: (draggedChannelId: string, targetChannelId: string) => void;
  onRemoveChannel: (channelId: string) => void;
  onToggleLoop: (channelId: string) => void;
  onToggleMute: (channelId: string) => void;
  onTogglePause: (channelId: string) => void;
  onToggleSolo: (channelId: string) => void;
  onToggleTransport: () => void;
  onProgress: (mixKey: string, channelId: string, progressSeconds: number) => void;
  mixKey: string;
  restartToken: number;
  transportPlaying: boolean;
};

export function TableSection({
  channelStates,
  focusedChannelId,
  onChangeChannelVolume,
  onFocusChannel,
  onReorderChannel,
  onRemoveChannel,
  onToggleLoop,
  onToggleMute,
  onTogglePause,
  onToggleSolo,
  onToggleTransport,
  onProgress,
  mixKey,
  restartToken,
  transportPlaying,
}: TableSectionProps) {
  const [draggedChannelId, setDraggedChannelId] = useState<string | null>(null);
  const [dragOverChannelId, setDragOverChannelId] = useState<string | null>(null);

  function resetDragState() {
    setDraggedChannelId(null);
    setDragOverChannelId(null);
  }

  function handleDrop(targetChannelId: string) {
    if (draggedChannelId && draggedChannelId !== targetChannelId) {
      onReorderChannel(draggedChannelId, targetChannelId);
    }

    resetDragState();
  }

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-blue-200/80 bg-[linear-gradient(180deg,_rgba(239,246,255,0.9),_#ffffff_18%)] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-blue-100/70 sm:p-5 dark:border-sky-400/25 dark:bg-[linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(15,23,42,0.88)_18%)] dark:ring-sky-400/10">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-sky-400 to-transparent dark:from-sky-400 dark:via-blue-500" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className={headingClassName}>
          Your table{" "}
          <span className="text-base font-medium text-slate-400 tabular-nums">
            {channelStates.length} / {MAX_CHANNELS}
          </span>
        </h2>
        <button
          type="button"
          onClick={onToggleTransport}
          disabled={channelStates.length === 0}
          className={`min-w-32 ${primaryButtonClassName}`}
        >
          {transportPlaying ? "Pause all" : "Play all"}
        </button>
      </div>

      {channelStates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {channelStates.map((channel, index) => {
            const isFocused = focusedChannelId === channel.id;

            return (
              <div
                key={channel.id}
                className={isFocused ? "order-first md:col-span-2 2xl:col-span-3" : undefined}
                onDragOver={event => {
                  if (!draggedChannelId || draggedChannelId === channel.id) {
                    return;
                  }

                  event.preventDefault();
                  setDragOverChannelId(channel.id);
                }}
                onDrop={event => {
                  event.preventDefault();
                  handleDrop(channel.id);
                }}
              >
                <VideoTile
                  channel={channel}
                  isDragging={draggedChannelId === channel.id}
                  isDragTarget={dragOverChannelId === channel.id}
                  isFocused={isFocused}
                  onChangeVolume={onChangeChannelVolume}
                  onDragEnd={resetDragState}
                  onDragStart={() => {
                    setDraggedChannelId(channel.id);
                    setDragOverChannelId(channel.id);
                  }}
                  onFocus={onFocusChannel}
                  onRemove={onRemoveChannel}
                  onToggleLoop={onToggleLoop}
                  onToggleMute={onToggleMute}
                  onTogglePause={onTogglePause}
                  onToggleSolo={onToggleSolo}
                  onProgress={onProgress}
                  mixKey={mixKey}
                  presentation={isFocused ? "focus" : "default"}
                  restartToken={restartToken}
                  trackLabel={`Channel ${index + 1}`}
                  transportPlaying={transportPlaying}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid min-h-[420px] place-items-center rounded-[28px] border border-dashed border-blue-200 bg-white/70 px-6 text-center shadow-inner dark:border-sky-400/20 dark:bg-slate-950/40">
          <div className="max-w-lg space-y-4">
            <h3 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">Add your first video</h3>
            <p className="text-base leading-7 text-slate-600 dark:text-slate-300">
              Search above or paste a YouTube link. Each video becomes a track you can reorder, focus, mute, solo, or
              loop.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
