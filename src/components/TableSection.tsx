import { useState } from "react";
import { VideoTile } from "./VideoTile";
import type { MixChannelState } from "../types";

type TableSectionProps = {
  channelStates: MixChannelState[];
  focusedChannelId: string | null;
  onFocusChannel: (channelId: string) => void;
  onReorderChannel: (draggedChannelId: string, targetChannelId: string) => void;
  onRemoveChannel: (channelId: string) => void;
  onToggleLoop: (channelId: string) => void;
  onToggleMute: (channelId: string) => void;
  onTogglePause: (channelId: string) => void;
  onToggleSolo: (channelId: string) => void;
  transportPlaying: boolean;
};

export function TableSection({
  channelStates,
  focusedChannelId,
  onFocusChannel,
  onReorderChannel,
  onRemoveChannel,
  onToggleLoop,
  onToggleMute,
  onTogglePause,
  onToggleSolo,
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
    ? channelStates.find(channel => channel.id === focusedChannelId) ?? null
    : null;

  function renderTile(channel: MixChannelState, index: number, presentation: "default" | "focus" = "default") {
    return (
      <div
        key={channel.id}
        className={presentation === "focus" ? "order-first md:col-span-2 2xl:col-span-3" : undefined}
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
          presentation={presentation}
          trackLabel={`Track ${index + 1}`}
          transportPlaying={transportPlaying}
        />
      </div>
    );
  }

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Table
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Arrange, build and shape your track
          </h2>
        </div>
        <p className="text-sm text-slate-500">
          Build the stack, drag tracks into order, then shape the blend below.
        </p>
      </div>

      {channelStates.length > 0 ? (
        <div className="space-y-5">
          {focusedChannel ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-blue-100 bg-blue-50/70 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Focus mode</p>
                <p className="mt-1 text-sm text-slate-600">
                  Theatre view keeps one channel large while the rest stay parked below.
                </p>
              </div>
              <p className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                Drag any card here or tap focus on another track to swap it in.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {channelStates.map(channel =>
              renderTile(
                channel,
                channelStates.findIndex(item => item.id === channel.id),
                focusedChannel?.id === channel.id ? "focus" : "default",
              ),
            )}
          </div>
        </div>
      ) : (
        <div className="grid min-h-[420px] place-items-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
          <div className="max-w-lg space-y-4">
            <h3 className="text-3xl font-semibold text-slate-950">
              Start the first layer
            </h3>
            <p className="text-base leading-7 text-slate-600">
              Add a rain bed, a piano loop, or a low-noise texture. Once
              channels are on the table, the mixer opens up underneath.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
