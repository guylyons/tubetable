import type { YouTubeSearchResult } from "../types";
import { SearchPanel } from "./SearchPanel";

type MixHeaderProps = {
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
  onSubmitSearch: () => void;
  onToggleTheme: () => void;
  searchError: string | null;
  searchQuery: string;
  searchResults: YouTubeSearchResult[];
  searchSuggestions: string[];
  showResults: boolean;
};

function TubetableLogo({ isDarkMode }: { isDarkMode: boolean }) {
  const logoText = "Tubetable";

  return (
    <div className="flex max-w-3xl flex-wrap items-center gap-4 sm:gap-5" aria-label={logoText}>
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
        <h1
          className={`text-5xl font-black sm:text-6xl lg:text-7xl ${isDarkMode ? "text-slate-50" : "text-slate-950"}`}
        >
          <span className="sr-only">{logoText}</span>
          <span aria-hidden="true" className="inline-flex tracking-normal">
            {[...logoText].map((letter, index) => (
              <span
                key={`${letter}-${index}`}
                className="tubetable-logo-letter"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                {letter}
              </span>
            ))}
          </span>
        </h1>
        <p
          className={`mt-2 text-base font-medium leading-7 sm:text-lg ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
        >
          Build a table of YouTube videos, then play and mix them together.
        </p>
      </div>
    </div>
  );
}

export function MixHeader({ isDarkMode, onSubmitSearch, onToggleTheme, ...searchProps }: MixHeaderProps) {
  return (
    <header
      className={`space-y-6 rounded-[32px] border p-5 shadow-sm sm:p-6 lg:p-7 ${
        isDarkMode
          ? "border-slate-800 bg-slate-900/85 text-slate-100 shadow-black/20"
          : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <TubetableLogo isDarkMode={isDarkMode} />
        <button
          type="button"
          onClick={onToggleTheme}
          className={`inline-flex shrink-0 cursor-pointer items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] transition ${
            isDarkMode ? "bg-sky-400/15 text-sky-200 hover:bg-sky-400/25" : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
          aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDarkMode ? "Light mode" : "Dark mode"}
        </button>
      </div>

      <SearchPanel isDarkMode={isDarkMode} onSubmit={onSubmitSearch} {...searchProps} />
    </header>
  );
}
