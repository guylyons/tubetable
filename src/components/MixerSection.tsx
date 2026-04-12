import type { MixChannelState } from "../types";

type MixerSectionProps = {
  channelStates: MixChannelState[];
  onChangeChannelVolume: (channelId: string, volume: number) => void;
};

export function MixerSection({ channelStates, onChangeChannelVolume }: MixerSectionProps) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Mixer panel</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Volume strips</h2>
        </div>
        <p className="text-sm text-slate-500">Each strip controls only channel volume.</p>
      </div>

      {channelStates.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {channelStates.map(channel => (
            <article
              key={`${channel.id}-strip`}
              className="flex w-[156px] shrink-0 flex-col items-center rounded-[28px] border border-slate-200 bg-slate-50 p-4"
            >
              <div className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center">
                <p className="line-clamp-2 text-sm font-semibold text-slate-900">{channel.video.title}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{channel.video.channelTitle}</p>
              </div>

              <div className="mt-4 flex flex-1 flex-col items-center justify-between gap-4">
                <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{channel.volume}%</div>

                <div className="flex flex-1 items-center justify-center">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={channel.volume}
                    onChange={event => onChangeChannelVolume(channel.id, Number(event.target.value))}
                    className="tubetable-slider tubetable-slider-vertical cursor-pointer appearance-none"
                    aria-label={`${channel.video.title} volume`}
                  />
                </div>

                <div className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center text-xs text-slate-600">
                  Output <span className="font-semibold text-slate-900">{channel.effectiveVolume}%</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-slate-500">
          The mixer panel fills itself as soon as you add the first channel.
        </div>
      )}
    </section>
  );
}
