import { VideoTile } from "./VideoTile";
import type { MixChannelState } from "../types";

type TableSectionProps = {
  channelStates: MixChannelState[];
  onRemoveChannel: (channelId: string) => void;
  onToggleMute: (channelId: string) => void;
  onTogglePause: (channelId: string) => void;
  transportPlaying: boolean;
};

export function TableSection({
  channelStates,
  onRemoveChannel,
  onToggleMute,
  onTogglePause,
  transportPlaying,
}: TableSectionProps) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Table</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Ambient table</h2>
        </div>
        <p className="text-sm text-slate-500">Build the stack, then shape the blend below with track-by-track control.</p>
      </div>

      {channelStates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {channelStates.map(channel => (
            <VideoTile
              key={channel.id}
              channel={channel}
              effectiveVolume={channel.effectiveVolume}
              onRemove={onRemoveChannel}
              onToggleMute={onToggleMute}
              onTogglePause={onTogglePause}
              transportPlaying={transportPlaying}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-[420px] place-items-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
          <div className="max-w-lg space-y-4">
            <h3 className="text-3xl font-semibold text-slate-950">Start the first layer</h3>
            <p className="text-base leading-7 text-slate-600">
              Add a rain bed, a piano loop, or a low-noise texture. Once channels are on the table, the mixer opens up
              underneath.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
