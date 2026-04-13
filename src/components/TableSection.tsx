import { useState } from "react";
import { VideoTile } from "./VideoTile";
import type { MixChannelState } from "../types";

type TableSectionProps = {
  channelStates: MixChannelState[];
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
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {channelStates.map((channel, index) => (
            <div
              key={channel.id}
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
                onDragEnd={resetDragState}
                onDragStart={() => {
                  setDraggedChannelId(channel.id);
                  setDragOverChannelId(channel.id);
                }}
                trackLabel={`Track ${index + 1}`}
                onRemove={onRemoveChannel}
                onToggleLoop={onToggleLoop}
                onToggleMute={onToggleMute}
                onTogglePause={onTogglePause}
                onToggleSolo={onToggleSolo}
                transportPlaying={transportPlaying}
              />
            </div>
          ))}
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
