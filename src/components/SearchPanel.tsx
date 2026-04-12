import type { YouTubeSearchResult } from "../types";

type SearchPanelProps = {
  addError: string | null;
  canAddMore: boolean;
  deferredQuery: string;
  existingVideoIds: Set<string>;
  isResolvingInput: boolean;
  isSearching: boolean;
  onChangeQuery: (value: string) => void;
  onCloseResults: () => void;
  onOpenResults: () => void;
  onSelectResult: (result: YouTubeSearchResult) => void;
  onSelectSuggestion: (suggestion: string) => void;
  onSubmit: () => void;
  searchError: string | null;
  searchQuery: string;
  searchResults: YouTubeSearchResult[];
  searchSuggestions: string[];
  showResults: boolean;
};

export function SearchPanel({
  addError,
  canAddMore,
  deferredQuery,
  existingVideoIds,
  isResolvingInput,
  isSearching,
  onChangeQuery,
  onCloseResults,
  onOpenResults,
  onSelectResult,
  onSelectSuggestion,
  onSubmit,
  searchError,
  searchQuery,
  searchResults,
  searchSuggestions,
  showResults,
}: SearchPanelProps) {
  return (
    <section className="relative z-40 rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          Search
        </p>
        <h2 className="text-2xl font-semibold text-slate-950"></h2>
        <p className="text-sm leading-6 text-slate-600">
          Type a lofi cue, rain loop, jazz texture, or paste a direct YouTube
          URL. Selecting a result drops it straight into the grid.
        </p>
      </div>

      <div className="relative mt-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="sr-only">Search YouTube</span>
            <textarea
              value={searchQuery}
              onChange={(event) => onChangeQuery(event.target.value)}
              onFocus={onOpenResults}
              onBlur={() => {
                window.setTimeout(onCloseResults, 120);
              }}
              rows={3}
              placeholder="Try: rainy lofi beat, brown noise, fireplace jazz..."
              className="min-h-[118px] w-full resize-none rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white"
              disabled={!canAddMore}
            />
          </label>

          <button
            type="submit"
            disabled={!canAddMore || isResolvingInput}
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isResolvingInput
              ? "Adding channel..."
              : "Add top result or pasted video"}
          </button>
        </form>

        {showResults ? (
          <div className="absolute inset-x-0 top-[calc(100%+14px)] z-[120] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl">
            {isSearching ? (
              <p className="px-4 py-5 text-sm text-slate-500">
                Searching YouTube...
              </p>
            ) : null}

            {!isSearching && searchSuggestions.length > 0 ? (
              <div className="border-b border-slate-100 px-3 py-3">
                <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Suggestions
                </p>
                <div className="flex flex-wrap gap-2">
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onSelectSuggestion(suggestion)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {!isSearching && searchResults.length > 0 ? (
              <div className="max-h-[420px] overflow-y-auto p-2">
                <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Top video matches
                </p>

                {searchResults.map((result) => {
                  const isAlreadyAdded = existingVideoIds.has(result.videoId);

                  return (
                    <button
                      key={result.videoId}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onSelectResult(result)}
                      disabled={isAlreadyAdded || !canAddMore}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <img
                        src={result.thumbnail}
                        alt=""
                        className="h-16 w-28 rounded-xl object-cover"
                        loading="lazy"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-slate-900">
                          {result.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {result.channelTitle}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                          {result.durationText ? (
                            <span>{result.durationText}</span>
                          ) : null}
                          {result.viewCountText ? (
                            <span>{result.viewCountText}</span>
                          ) : null}
                          {isAlreadyAdded ? (
                            <span className="text-blue-700">
                              Already in mix
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {!isSearching && searchError ? (
              <p className="px-4 py-5 text-sm text-red-600">{searchError}</p>
            ) : null}

            {!isSearching &&
            !searchError &&
            searchResults.length === 0 &&
            searchSuggestions.length === 0 &&
            deferredQuery.length >= 2 ? (
              <p className="px-4 py-5 text-sm text-slate-500">
                No matching videos yet. Refine the search phrase.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {addError ? (
        <p className="mt-3 text-sm text-red-600">{addError}</p>
      ) : null}
      {!canAddMore ? (
        <p className="mt-3 text-sm text-slate-500">
          The grid is full. Remove a channel before adding another one.
        </p>
      ) : null}
    </section>
  );
}
