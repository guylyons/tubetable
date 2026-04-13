import type { MixChannelState } from "../types";

type MixerSectionProps = {
  isDarkMode: boolean;
  channelStates: MixChannelState[];
  onChangeChannelVolume: (channelId: string, volume: number) => void;
};

export function MixerSection({
  isDarkMode,
  channelStates,
  onChangeChannelVolume,
}: MixerSectionProps) {
  return (
    <section className={`rounded-[32px] border p-5 sm:p-6 ${isDarkMode ? "border-slate-800 bg-slate-900 text-slate-100 shadow-black/20" : "border-slate-200 bg-white text-slate-900 shadow-sm"}`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Mixer
          </p>
          <h2 className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-slate-50" : "text-slate-950"}`}>Per-channel volume</h2>
        </div>
        <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-500"}`}>
          Adjust each channel against the master volume. The mixer appears as
          soon as you add a channel.
        </p>
      </div>

      {channelStates.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {channelStates.map((channel, index) => {
            const trackLabel = `Channel ${index + 1}`;

            return (
              <article
                key={`${channel.id}-strip`}
                className={`flex w-[156px] shrink-0 flex-col items-center rounded-[28px] border p-2 ${
                  isDarkMode ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className={`w-full rounded-2xl border px-3 py-3 text-center ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                    {trackLabel}
                  </p>
                  <p className={`mt-2 line-clamp-2 text-sm font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                    {channel.video.title}
                  </p>
                  <p className={`mt-1 truncate text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {channel.video.channelTitle}
                  </p>
                </div>

                <div className="mt-4 flex flex-1 flex-col items-center justify-between gap-2">
                  <div className={`rounded-full px-3 py-1 text-sm font-semibold ${isDarkMode ? "bg-sky-500/10 text-sky-200" : "bg-blue-50 text-blue-700"}`}>
                    {channel.volume}%
                  </div>

                  <div className="flex flex-1 items-center justify-center">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={channel.volume}
                      onChange={(event) =>
                        onChangeChannelVolume(
                          channel.id,
                          Number(event.target.value),
                        )
                      }
                      className="tubetable-slider tubetable-slider-vertical cursor-pointer appearance-none"
                      aria-label={`${trackLabel} volume`}
                    />
                  </div>

                  <div className={`w-full rounded-2xl border px-3 py-2 text-center text-xs ${isDarkMode ? "border-slate-800 bg-slate-900 text-slate-300" : "border-slate-200 bg-white text-slate-600"}`}>
                    Output{" "}
                    <span className={`font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                      {channel.effectiveVolume}%
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={`rounded-[28px] border border-dashed px-6 py-12 text-center ${isDarkMode ? "border-slate-700 bg-slate-950/40 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          Add a channel to open the mixer.
        </div>
      )}
    </section>
  );
}
