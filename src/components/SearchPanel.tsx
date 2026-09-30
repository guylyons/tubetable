import { useEffect, useState, type KeyboardEvent } from "react";
import { parseYouTubeVideoId } from "../lib/youtube";
import type { YouTubeSearchResult } from "../types";
import { mutedTextClassName, primaryButtonClassName } from "./ui";

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

const RESULTS_ID = "search-results";

function resultOptionId(index: number) {
  return `search-result-${index}`;
}

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
  const [activeIndex, setActiveIndex] = useState(-1);
  const isLink = parseYouTubeVideoId(searchQuery) !== null;
  const hasResults = !isSearching && searchResults.length > 0;
  const resultsOpen = showResults && searchQuery.trim().length > 0;
  const canSubmit = canAddMore && !isResolvingInput && (isLink || hasResults);

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchResults, showResults]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      onCloseResults();
      return;
    }

    if (!hasResults || (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter")) {
      return;
    }

    if (event.key === "Enter") {
      const activeResult = searchResults[activeIndex];
      if (resultsOpen && activeResult) {
        event.preventDefault();
        onSelectResult(activeResult);
      }
      return;
    }

    event.preventDefault();
    onOpenResults();
    const step = event.key === "ArrowDown" ? 1 : -1;
    setActiveIndex(current => (current + step + searchResults.length) % searchResults.length);
  }

  return (
    <section className="relative z-40">
      <form
        onSubmit={event => {
          event.preventDefault();
          onSubmit();
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search YouTube or paste a video link</span>
          <input
            type="search"
            enterKeyHint="go"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={RESULTS_ID}
            aria-expanded={resultsOpen && hasResults}
            aria-activedescendant={activeIndex >= 0 ? resultOptionId(activeIndex) : undefined}
            value={searchQuery}
            onChange={event => onChangeQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onOpenResults}
            onBlur={() => {
              window.setTimeout(onCloseResults, 120);
            }}
            placeholder={canAddMore ? "Search a song, channel, or mood — or paste a YouTube link" : "The table is full"}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:bg-slate-950"
            disabled={!canAddMore}
          />
        </label>

        <button type="submit" disabled={!canSubmit} className={`sm:w-40 ${primaryButtonClassName}`}>
          {isResolvingInput ? "Adding…" : isLink || !searchQuery.trim() ? "Add video" : "Add top result"}
        </button>
      </form>

      {resultsOpen ? (
        <div className="absolute inset-x-0 top-[calc(100%+10px)] z-[120] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {isSearching ? <p className={`px-4 py-5 text-sm ${mutedTextClassName}`}>Searching YouTube…</p> : null}

          {!isSearching && searchSuggestions.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-b border-slate-100 px-3 py-3 dark:border-slate-800">
              {searchSuggestions.map(suggestion => (
                <button
                  key={suggestion}
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => onSelectSuggestion(suggestion)}
                  className="cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-400 dark:hover:bg-slate-700 dark:hover:text-sky-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          {hasResults ? (
            <div
              id={RESULTS_ID}
              role="listbox"
              aria-label="Search results"
              className="max-h-[420px] overflow-y-auto p-2"
            >
              {searchResults.map((result, index) => {
                const isAlreadyAdded = existingVideoIds.has(result.videoId);
                const isActive = index === activeIndex;

                return (
                  <div
                    key={result.videoId}
                    id={resultOptionId(index)}
                    role="option"
                    aria-selected={isActive}
                    aria-disabled={isAlreadyAdded || !canAddMore}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => onSelectResult(result)}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:hover:bg-slate-800 ${
                      isActive ? "bg-slate-100 dark:bg-slate-800" : ""
                    }`}
                  >
                    <img src={result.thumbnail} alt="" className="h-16 w-28 rounded-xl object-cover" loading="lazy" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium">{result.title}</p>
                      <p className={`mt-1 text-xs ${mutedTextClassName}`}>{result.channelTitle}</p>
                      <p className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                        {result.durationText ? <span>{result.durationText}</span> : null}
                        {result.viewCountText ? <span>{result.viewCountText}</span> : null}
                        {isAlreadyAdded ? <span className="text-blue-700 dark:text-sky-300">Already added</span> : null}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!isSearching && searchError ? (
            <p className="px-4 py-5 text-sm text-red-600 dark:text-red-300">{searchError}</p>
          ) : null}

          {!isSearching &&
          !searchError &&
          searchResults.length === 0 &&
          searchSuggestions.length === 0 &&
          deferredQuery.length >= 2 ? (
            <p className={`px-4 py-5 text-sm ${mutedTextClassName}`}>
              No results yet. Try a shorter search or paste a YouTube link.
            </p>
          ) : null}
        </div>
      ) : null}

      {addError ? <p className="mt-3 text-sm text-red-600 dark:text-red-300">{addError}</p> : null}
    </section>
  );
}
