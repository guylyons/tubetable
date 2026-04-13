import { getTransportLabel } from "../lib/mixChannels";
import {
  MAX_CHANNELS,
  type MixChannelState,
  type YouTubeSearchResult,
} from "../types";
import { TransportVisualizer } from "./TransportVisualizer";
import { SearchPanel } from "./SearchPanel";

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
          <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "bg-blue-500/15 text-blue-200" : "bg-blue-50 text-blue-700"}`}>
            Tubetable
          </div>
          <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
            {audibleChannels} active channels
          </div>
          <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
            {isSavedMix ? "Saved mix" : "Draft mix"}
          </div>
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
          <h1 className={`max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl ${isDarkMode ? "text-slate-50" : "text-slate-950"}`}>
            Build and control a layered mix.
          </h1>
          <p className={`max-w-2xl text-base leading-7 sm:text-lg ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            Search YouTube, add up to five channels, and balance them in one
            workspace.
          </p>
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
