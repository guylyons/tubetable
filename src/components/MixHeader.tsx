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
  onChangeQuery: (value: string) => void;
  onCloseResults: () => void;
  onOpenResults: () => void;
  onSelectResult: (result: YouTubeSearchResult) => void;
  onSelectSuggestion: (suggestion: string) => void;
  onSubmitSearch: () => void;
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
  isResolvingInput,
  isSearching,
  onChangeQuery,
  onCloseResults,
  onOpenResults,
  onSelectResult,
  onSelectSuggestion,
  onSubmitSearch,
  onToggleTransport,
  searchError,
  searchQuery,
  searchResults,
  searchSuggestions,
  showResults,
  transportPlaying,
}: MixHeaderProps) {
  return (
    <header className="grid gap-8 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[minmax(0,1.25fr)_340px] lg:p-8">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Tubetable [channels:{audibleChannels}]
          </div>
          <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {isSavedMix ? "Saved mix" : "Draft mix"}
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Build your own layered mix.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Search YouTube, add up to five channels, and balance them in one
            clean workspace with simple blue controls.
          </p>
        </div>

        <SearchPanel
          addError={addError}
          canAddMore={canAddMore}
          deferredQuery={deferredQuery}
          existingVideoIds={existingVideoIds}
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
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Channels
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {channelsCount}
            <span className="ml-2 text-base text-slate-400">
              / {MAX_CHANNELS}
            </span>
          </p>
        </div>

        <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 lg:col-span-1">
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
