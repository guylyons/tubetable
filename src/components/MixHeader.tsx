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
    <div className="flex flex-wrap items-center gap-4 sm:gap-5" aria-label={logoText}>
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
