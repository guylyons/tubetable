import { Loader2, Plus, Search } from "lucide-react";
import { useEffect, useState, type KeyboardEvent, type RefObject } from "react";
import { parseYouTubeVideoId } from "../lib/youtube";
import type { YouTubeSearchResult } from "../types";
import { accentButtonClassName } from "./ui";

type SearchBarProps = {
  addError: string | null;
  canAddMore: boolean;
  className?: string;
  deferredQuery: string;
  existingVideoIds: Set<string>;
  inputRef: RefObject<HTMLInputElement | null>;
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

export function SearchBar({
  addError,
  canAddMore,
  className = "",
  deferredQuery,
  existingVideoIds,
  inputRef,
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
}: SearchBarProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const isLink = parseYouTubeVideoId(searchQuery) !== null;
  const hasResults = !isSearching && searchResults.length > 0;
  const resultsOpen = showResults && searchQuery.trim().length > 0;
  const isEmpty = searchQuery.trim().length === 0;
  // With nothing typed, the button focuses the search box, so it stays enabled.
  const canSubmit = canAddMore && !isResolvingInput && (isEmpty || isLink || hasResults);

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchResults, showResults]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (resultsOpen) {
        event.stopPropagation();
        onCloseResults();
      } else {
        event.currentTarget.blur();
      }
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
    <div className={`relative ${className}`}>
      <form
        onSubmit={event => {
          event.preventDefault();
          onSubmit();
        }}
        className="flex gap-2"
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search YouTube or paste a video link</span>
          {isSearching ? (
            <Loader2
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 animate-spin text-field-muted"
            />
          ) : (
            <Search
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-field-muted"
            />
          )}
          <input
            ref={inputRef}
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
            placeholder={canAddMore ? "Search YouTube or paste a link" : "All five channels are in use"}
            disabled={!canAddMore}
            className="h-11 w-full rounded-lg border border-line bg-field pl-11 pr-3 text-[0.95rem] text-field-ink shadow-inner outline-none transition placeholder:text-field-muted hover:bg-white focus:border-focus focus:bg-white focus:ring-2 focus:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className={`h-11 w-11 shrink-0 sm:w-auto sm:px-4 ${accentButtonClassName}`}
        >
          {isResolvingInput ? (
            <Loader2 size={18} aria-hidden="true" className="animate-spin" />
          ) : (
            <Plus size={18} aria-hidden="true" />
          )}
          <span className="sr-only sm:not-sr-only">
            {isResolvingInput ? "Adding…" : isLink || isEmpty ? "Add video" : "Add top result"}
          </span>
        </button>
      </form>

      {resultsOpen ? (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-line bg-card text-ink shadow-2xl">
          {isSearching ? <p className="px-4 py-4 text-sm text-ink-muted">Searching YouTube…</p> : null}

          {!isSearching && searchSuggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-b border-line px-3 py-3">
              {searchSuggestions.map(suggestion => (
                <button
                  key={suggestion}
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => onSelectSuggestion(suggestion)}
                  className="cursor-pointer rounded-md border border-line bg-panel px-2.5 py-1 text-xs transition hover:bg-card-hover"
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
              className="max-h-[26rem] overflow-y-auto p-1.5"
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
                    className={`flex cursor-pointer items-center gap-3 rounded-lg p-2 transition hover:bg-card-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ${
                      isActive ? "bg-card-hover ring-2 ring-focus" : ""
                    }`}
                  >
                    <img
                      src={result.thumbnail}
                      alt=""
                      className="aspect-video w-28 shrink-0 rounded-md bg-black object-cover"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium">{result.title}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-muted">
                        <span>{result.channelTitle}</span>
                        {result.durationText ? <span>{result.durationText}</span> : null}
                        {result.viewCountText ? <span>{result.viewCountText}</span> : null}
                        {isAlreadyAdded ? <span className="font-semibold">Already added</span> : null}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!isSearching && searchError ? <p className="px-4 py-4 text-sm text-danger">{searchError}</p> : null}

          {!isSearching &&
          !searchError &&
          searchResults.length === 0 &&
          searchSuggestions.length === 0 &&
          deferredQuery.length >= 2 ? (
            <p className="px-4 py-4 text-sm text-ink-muted">
              No results yet. Try a shorter search or paste a YouTube link.
            </p>
          ) : null}
        </div>
      ) : null}

      {addError ? (
        <p role="alert" className="absolute left-0 top-[calc(100%+6px)] text-sm font-medium text-fg">
          {addError}
        </p>
      ) : null}
    </div>
  );
}
