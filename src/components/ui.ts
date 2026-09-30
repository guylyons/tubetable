export const panelClassName =
  "rounded-[32px] border border-slate-200 bg-white p-4 text-slate-900 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-black/20";

export const headingClassName = "text-2xl font-semibold text-slate-950 dark:text-slate-50";

export const mutedTextClassName = "text-slate-500 dark:text-slate-400";

export const inputClassName =
  "w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:bg-slate-950";

export const primaryButtonClassName =
  "cursor-pointer rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-500 dark:hover:bg-sky-400";

export const secondaryButtonClassName =
  "cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-400 dark:hover:text-sky-200";

export function toggleButtonClassName(pressed: boolean) {
  return `cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-sky-300 ${
    pressed
      ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200"
      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-400 dark:hover:text-sky-200"
  }`;
}
