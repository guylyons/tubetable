import { getTransportLabel } from "../lib/mixChannels";
import {
  MAX_CHANNELS,
  type MixChannelState,
  type YouTubeSearchResult,
} from "../types";
import { SearchPanel } from "./SearchPanel";
import { TransportVisualizer } from "./TransportVisualizer";

type MixHeaderProps = {
  addError: string | null;
  audibleChannels: number;
  canAddMore: boolean;
  channelStates: MixChannelState[];
  channelsCount: number;
  deferredQuery: string;
  existingVideoIds: Set<string>;
  isSavedMix: boolean;
  isResolvingInput: boolean;
  isSearching: boolean;
  isDarkMode: boolean;
  onChangeQuery: (value: string) => void;
  onCloseResults: () => void;
  onOpenResults: () => void;
  onSelectResult: (result: YouTubeSearchResult) => void;
  onSelectSuggestion: (suggestion: string) => void;
  onSubmitSearch: () => void;
  onToggleTheme: () => void;
  onToggleTransport: () => void;
  searchError: string | null;
  searchQuery: string;
  searchResults: YouTubeSearchResult[];
  searchSuggestions: string[];
  showResults: boolean;
  transportPlaying: boolean;
};

function TubetableLogo({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className="flex max-w-3xl items-center gap-4 sm:gap-5" aria-label="Tubetable">
      <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-[1.75rem] bg-gradient-to-br from-sky-400 to-blue-700 shadow-lg shadow-blue-500/20 sm:h-24 sm:w-24">
        <div className="absolute inset-x-4 bottom-4 h-2 rounded-full bg-blue-950/30" />
        <div className="relative h-12 w-12 rounded-full bg-white shadow-inner sm:h-14 sm:w-14">
          <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-700" />
          <div className="absolute -right-5 top-3 h-8 w-8 rounded-full bg-white shadow-inner sm:-right-6 sm:h-9 sm:w-9" />
          <div className="absolute -right-2 top-6 h-3 w-3 rounded-full bg-blue-700" />
        </div>
        <div className="absolute left-11 top-4 rotate-[-8deg] rounded-full bg-amber-300 px-2 py-1 text-lg font-black leading-none text-orange-600 shadow-sm sm:left-[3.25rem]">
          ♪
        </div>
      </div>
      <div>
        <h1 className={`text-5xl font-black tracking-[-0.045em] sm:text-6xl lg:text-7xl ${isDarkMode ? "text-slate-50" : "text-slate-950"}`}>
          Tubetable
        </h1>
        <p className={`mt-2 text-base font-medium leading-7 sm:text-lg ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
          Mix YouTube clips like a tiny soundboard.
        </p>
      </div>
    </div>
  );
}

export function MixHeader({
  addError,
  audibleChannels,
  canAddMore,
  channelStates,
  channelsCount,
  deferredQuery,
  existingVideoIds,
  isSavedMix,
  isDarkMode,
  isResolvingInput,
  isSearching,
  onChangeQuery,
  onCloseResults,
  onOpenResults,
  onSelectResult,
  onSelectSuggestion,
  onSubmitSearch,
  onToggleTheme,
  onToggleTransport,
  searchError,
  searchQuery,
  searchResults,
  searchSuggestions,
  showResults,
  transportPlaying,
}: MixHeaderProps) {
  return (
    <header
      className={`grid gap-8 rounded-[32px] border p-6 shadow-sm lg:grid-cols-[minmax(0,1.25fr)_340px] lg:p-8 ${
        isDarkMode
          ? "border-slate-800 bg-slate-900/85 text-slate-100 shadow-black/20"
          : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] transition ${
              isDarkMode
                ? "bg-sky-400/15 text-sky-200 hover:bg-sky-400/25"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? "Light mode" : "Dark mode"}
          </button>
        </div>

        <div className="space-y-4">
          <TubetableLogo isDarkMode={isDarkMode} />
        </div>

        <SearchPanel
          addError={addError}
          canAddMore={canAddMore}
          deferredQuery={deferredQuery}
          existingVideoIds={existingVideoIds}
          isDarkMode={isDarkMode}
          isResolvingInput={isResolvingInput}
          isSearching={isSearching}
          onChangeQuery={onChangeQuery}
          onCloseResults={onCloseResults}
          onOpenResults={onOpenResults}
          onSelectResult={onSelectResult}
          onSelectSuggestion={onSelectSuggestion}
          onSubmit={onSubmitSearch}
          searchError={searchError}
          searchQuery={searchQuery}
          searchResults={searchResults}
          searchSuggestions={searchSuggestions}
          showResults={showResults}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
        <div className={`rounded-3xl border p-4 ${isDarkMode ? "border-slate-800 bg-slate-800/70" : "border-slate-200 bg-slate-50"}`}>
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            Channels
          </p>
          <p className={`mt-3 text-3xl font-semibold ${isDarkMode ? "text-slate-50" : "text-slate-950"}`}>
            {channelsCount}
            <span className={`ml-2 text-base ${isDarkMode ? "text-slate-400" : "text-slate-400"}`}>
              / {MAX_CHANNELS}
            </span>
          </p>
        </div>

        <div className={`space-y-3 rounded-3xl border p-4 sm:col-span-2 lg:col-span-1 ${isDarkMode ? "border-slate-800 bg-slate-800/70" : "border-slate-200 bg-slate-50"}`}>
          <TransportVisualizer
            channelStates={channelStates}
            transportPlaying={transportPlaying}
          />
          <button
            type="button"
            onClick={onToggleTransport}
            className="inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            {getTransportLabel(transportPlaying)}
          </button>
        </div>
      </div>
    </header>
  );
}
