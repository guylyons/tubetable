import { useState } from "react";
import { VideoTile } from "./VideoTile";
import type { MixChannel, MixChannelState } from "../types";

type TableSectionProps = {
  isDarkMode: boolean;
  channelStates: MixChannelState[];
  focusedChannelId: string | null;
  onFocusChannel: (channelId: string) => void;
  onReorderChannel: (draggedChannelId: string, targetChannelId: string) => void;
  onRemoveChannel: (channelId: string) => void;
  onToggleLoop: (channelId: string) => void;
  onToggleMute: (channelId: string) => void;
  onTogglePause: (channelId: string) => void;
  onToggleSolo: (channelId: string) => void;
  onPatchChannel: (channelId: string, patch: Partial<MixChannel>) => void;
  onProgress: (mixKey: string, channelId: string, progressSeconds: number) => void;
  mixKey: string;
  restartToken: number;
  transportPlaying: boolean;
};

export function TableSection({
  isDarkMode,
  channelStates,
  focusedChannelId,
  onFocusChannel,
  onReorderChannel,
  onRemoveChannel,
  onToggleLoop,
  onToggleMute,
  onTogglePause,
  onToggleSolo,
  onPatchChannel,
  onProgress,
  mixKey,
  restartToken,
  transportPlaying,
}: TableSectionProps) {
  const [draggedChannelId, setDraggedChannelId] = useState<string | null>(null);
  const [dragOverChannelId, setDragOverChannelId] = useState<string | null>(
    null,
  );

  function resetDragState() {
    setDraggedChannelId(null);
    setDragOverChannelId(null);
  }

  function handleDrop(targetChannelId: string) {
    if (!draggedChannelId || draggedChannelId === targetChannelId) {
      resetDragState();
      return;
    }

    onReorderChannel(draggedChannelId, targetChannelId);
    resetDragState();
  }

  const focusedChannel = focusedChannelId
    ? (channelStates.find((channel) => channel.id === focusedChannelId) ?? null)
    : null;

  function renderTile(
    channel: MixChannelState,
    index: number,
    presentation: "default" | "focus" = "default",
  ) {
    return (
      <div
        key={channel.id}
        className={
          presentation === "focus"
            ? "order-first md:col-span-2 2xl:col-span-3"
            : undefined
        }
        onDragOver={(event) => {
          if (!draggedChannelId || draggedChannelId === channel.id) {
            return;
          }

          event.preventDefault();
          setDragOverChannelId(channel.id);
        }}
        onDrop={(event) => {
          event.preventDefault();
          handleDrop(channel.id);
        }}
      >
        <VideoTile
          isDarkMode={isDarkMode}
          channel={channel}
          effectiveVolume={channel.effectiveVolume}
          isDragging={draggedChannelId === channel.id}
          isDragTarget={dragOverChannelId === channel.id}
          isFocused={focusedChannelId === channel.id}
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
          onPatchChannel={onPatchChannel}
          onProgress={onProgress}
          mixKey={mixKey}
          presentation={presentation}
          restartToken={restartToken}
          trackLabel={`Channel ${index + 1}`}
          transportPlaying={transportPlaying}
        />
      </div>
    );
  }

  return (
    <section
      className={`relative overflow-hidden rounded-[32px] border p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 sm:p-6 ${
        isDarkMode
          ? "border-sky-400/25 bg-[linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(15,23,42,0.88)_18%)] ring-sky-400/10"
          : "border-blue-200/80 bg-[linear-gradient(180deg,_rgba(239,246,255,0.9),_#ffffff_18%)] ring-blue-100/70"
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${isDarkMode ? "from-sky-400 via-blue-500 to-transparent" : "from-blue-500 via-sky-400 to-transparent"}`}
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Table
          </p>
          <h2
            className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-slate-50" : "text-slate-950"}`}
          >
            Arrange and feature channels
          </h2>
        </div>
        <p
          className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-500"}`}
        >
          Drag channels to reorder them, then focus one to make it the featured
          view.
        </p>
      </div>

      {channelStates.length > 0 ? (
        <div className="space-y-5">
          {focusedChannel ? (
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-[28px] border px-4 py-3 shadow-sm ${
                isDarkMode
                  ? "border-sky-400/20 bg-slate-950/60"
                  : "border-blue-100 bg-white/80"
              }`}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                  Focus mode
                </p>
                <p
                  className={`mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                >
                  The focused channel stays large while the rest remain below.
                </p>
              </div>
              <p
                className={`rounded-full px-3 py-1 text-xs font-medium ${isDarkMode ? "bg-slate-900 text-slate-300" : "bg-white text-slate-600"}`}
              >
                Drag a channel here or tap Focus on another one to switch it.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {channelStates.map((channel) =>
              renderTile(
                channel,
                channelStates.findIndex((item) => item.id === channel.id),
                focusedChannel?.id === channel.id ? "focus" : "default",
              ),
            )}
          </div>
        </div>
      ) : (
        <div
          className={`grid min-h-[420px] place-items-center rounded-[28px] border border-dashed px-6 text-center shadow-inner ${
            isDarkMode
              ? "border-sky-400/20 bg-slate-950/40"
              : "border-blue-200 bg-white/70"
          }`}
        >
          <div className="max-w-lg space-y-4">
            <h3
              className={`text-3xl font-semibold ${isDarkMode ? "text-slate-50" : "text-slate-950"}`}
            >
              Add your first channel
            </h3>
            <p
              className={`text-base leading-7 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
            >
              Search for a video, add it to the mix, and use focus mode or the
              mixer to shape the result.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
