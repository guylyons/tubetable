import { getStripStatus } from "../lib/mixChannels";
import type { MixChannelState } from "../types";

type MixerSectionProps = {
  isDarkMode: boolean;
  channelStates: MixChannelState[];
  onChangeChannelVolume: (channelId: string, volume: number) => void;
  onToggleMute: (channelId: string) => void;
  onToggleSolo: (channelId: string) => void;
};

export function MixerSection({
  isDarkMode,
  channelStates,
  onChangeChannelVolume,
  onToggleMute,
  onToggleSolo,
}: MixerSectionProps) {
  const toggleClassName = (pressed: boolean) =>
    `flex-1 cursor-pointer rounded-full border px-2 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
      isDarkMode ? "focus-visible:outline-sky-300" : "focus-visible:outline-blue-700"
    } ${
      pressed
        ? isDarkMode
          ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
          : "border-blue-200 bg-blue-50 text-blue-700"
        : isDarkMode
          ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400 hover:text-sky-200"
          : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
    }`;

  return (
    <section className={`rounded-[32px] border p-4 sm:p-5 ${isDarkMode ? "border-slate-800 bg-slate-900 text-slate-100 shadow-black/20" : "border-slate-200 bg-white text-slate-900 shadow-sm"}`}>
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}>
            Mixer
          </p>
          <h2 className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-slate-50" : "text-slate-950"}`}>Track volumes</h2>
        </div>
      </div>

      {channelStates.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {channelStates.map((channel, index) => {
            const trackLabel = `Channel ${index + 1}`;
            const { silencedBy, levelLabel } = getStripStatus(channel);
            const dimClassName = silencedBy ? "opacity-45" : "";

            return (
              <article
                key={`${channel.id}-strip`}
                className={`flex w-[156px] shrink-0 flex-col items-center rounded-[28px] border p-2 ${
                  isDarkMode ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className={`w-full rounded-2xl border px-3 py-3 text-center transition-opacity motion-reduce:transition-none ${dimClassName} ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDarkMode ? "text-sky-300" : "text-blue-700"}`}>
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
                  <div className="flex flex-col items-center gap-1 text-center">
                    <div
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${
                        silencedBy
                          ? isDarkMode
                            ? "bg-slate-800 text-slate-400"
                            : "bg-slate-200 text-slate-600"
                          : isDarkMode
                            ? "bg-sky-500/10 text-sky-200"
                            : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {levelLabel}
                    </div>
                    <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      Fader {channel.volume}%
                    </p>
                  </div>

                  <div className={`flex flex-1 items-center justify-center transition-opacity motion-reduce:transition-none ${dimClassName}`}>
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
                </div>

                <div className="mt-2 flex w-full gap-1.5">
                  <button
                    type="button"
                    onClick={() => onToggleMute(channel.id)}
                    aria-pressed={channel.muted}
                    aria-label={`Mute ${trackLabel}`}
                    className={toggleClassName(channel.muted)}
                  >
                    Mute
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleSolo(channel.id)}
                    aria-pressed={channel.solo}
                    aria-label={`Solo ${trackLabel}`}
                    className={toggleClassName(channel.solo)}
                  >
                    Solo
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={`rounded-[28px] border border-dashed px-6 py-12 text-center ${isDarkMode ? "border-slate-700 bg-slate-950/40 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          Add a video to open the mixer.
        </div>
      )}
    </section>
  );
}
