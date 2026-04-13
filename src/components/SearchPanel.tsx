import type { YouTubeSearchResult } from "../types";

type SearchPanelProps = {
  addError: string | null;
  canAddMore: boolean;
  deferredQuery: string;
  existingVideoIds: Set<string>;
  isResolvingInput: boolean;
  isSearching: boolean;
  isDarkMode: boolean;
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
  isDarkMode,
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
    <section className={`relative z-40 rounded-[28px] p-4 sm:p-5 ${isDarkMode ? "bg-slate-900 text-slate-100 shadow-black/20" : "bg-white text-slate-900 shadow-sm"}`}>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          Search
        </p>
        <p className={`text-sm leading-6 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
          Search by title, channel, or mood. Paste a YouTube URL to add it
          directly.
        </p>
      </div>

      <div className="relative mt-4">
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
              rows={2}
              placeholder="Search by title, channel, mood, or paste a YouTube URL"
              className={`min-h-[84px] w-full resize-none rounded-3xl border px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 ${
                isDarkMode
                  ? "border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-400 focus:bg-slate-950"
                  : "border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-300 focus:bg-white"
              }`}
              disabled={!canAddMore}
            />
          </label>

          <button
            type="submit"
            disabled={!canAddMore || isResolvingInput}
            className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isDarkMode ? "bg-sky-500 hover:bg-sky-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isResolvingInput
              ? "Adding channel..."
              : "Add video"}
          </button>
        </form>

        {showResults ? (
          <div className={`absolute inset-x-0 top-[calc(100%+14px)] z-[120] overflow-hidden rounded-[28px] border shadow-xl ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
            {isSearching ? (
              <p className={`px-4 py-5 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Searching YouTube...
              </p>
            ) : null}

            {!isSearching && searchSuggestions.length > 0 ? (
              <div className="border-b border-slate-100 px-3 py-3">
                <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Search suggestions
                </p>
                <div className="flex flex-wrap gap-2">
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onSelectSuggestion(suggestion)}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs transition ${
                        isDarkMode
                          ? "border-slate-700 bg-slate-800 text-slate-200 hover:border-sky-400 hover:bg-slate-700 hover:text-sky-200"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      }`}
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
                  Results
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
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        isDarkMode ? "hover:bg-slate-800" : "hover:bg-slate-50"
                      }`}
                    >
                      <img
                        src={result.thumbnail}
                        alt=""
                        className="h-16 w-28 rounded-xl object-cover"
                        loading="lazy"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`line-clamp-2 text-sm font-medium ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                          {result.title}
                        </p>
                        <p className={`mt-1 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                          {result.channelTitle}
                        </p>
                        <div className={`mt-1 flex flex-wrap gap-2 text-[11px] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
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
              <p className={`px-4 py-5 text-sm ${isDarkMode ? "text-red-300" : "text-red-600"}`}>{searchError}</p>
            ) : null}

            {!isSearching &&
            !searchError &&
            searchResults.length === 0 &&
            searchSuggestions.length === 0 &&
            deferredQuery.length >= 2 ? (
              <p className="px-4 py-5 text-sm text-slate-500">
                No matches yet. Try a shorter or broader search.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {addError ? (
        <p className={`mt-3 text-sm ${isDarkMode ? "text-red-300" : "text-red-600"}`}>{addError}</p>
      ) : null}
      {!canAddMore ? (
        <p className={`mt-3 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          The grid is full. Remove a channel before adding another one.
        </p>
      ) : null}
    </section>
  );
}
