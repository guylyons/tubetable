import type { ComponentProps } from "react";
import { SearchPanel } from "./SearchPanel";

type MixHeaderProps = ComponentProps<typeof SearchPanel> & {
  isDarkMode: boolean;
  onToggleTheme: () => void;
};

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function TubetableLogo() {
  const logoText = "Tubetable";

  return (
    <div>
      <h1 className="text-5xl font-black text-slate-950 sm:text-6xl dark:text-slate-50">
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
      <p className="mt-2 text-base font-medium text-slate-600 dark:text-slate-300">
        Build a table of YouTube videos, then play and mix them together.
      </p>
    </div>
  );
}

export function MixHeader({ isDarkMode, onToggleTheme, ...searchProps }: MixHeaderProps) {
  return (
    <header className="relative grid gap-6 rounded-[32px] border border-slate-200 bg-white p-5 text-slate-900 shadow-sm sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-10 lg:p-7 dark:border-slate-800 dark:bg-slate-900/85 dark:text-slate-100 dark:shadow-black/20">
      <button
        type="button"
        onClick={onToggleTheme}
        className="absolute right-5 top-5 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800 sm:right-6 sm:top-6 dark:bg-sky-400/15 dark:text-sky-200 dark:hover:bg-sky-400/25"
        aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
        title={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
      >
        {isDarkMode ? <SunIcon /> : <MoonIcon />}
      </button>
      <TubetableLogo />
      <div className="lg:pt-8">
        <SearchPanel {...searchProps} />
      </div>
    </header>
  );
}
