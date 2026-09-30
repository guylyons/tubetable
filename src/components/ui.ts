export const eyebrowClassName = "text-[0.7rem] font-bold uppercase tracking-[0.14em]";

export const panelClassName = "rounded-xl border border-line bg-panel text-ink shadow-sm";

const buttonBaseClassName =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium transition select-none disabled:cursor-not-allowed disabled:opacity-50";

export const accentButtonClassName = `${buttonBaseClassName} bg-accent text-accent-ink shadow-sm hover:bg-accent-hover`;

export const quietButtonClassName = `${buttonBaseClassName} border border-line bg-card text-ink hover:bg-card-hover`;

export const iconButtonClassName =
  "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-50";

// Mute, Solo and Focus on a channel card.
export function toggleButtonClassName(pressed: boolean) {
  return `${buttonBaseClassName} h-10 flex-1 border ${
    pressed
      ? "border-transparent bg-(--pressed-bg) text-(--pressed-ink) shadow-inner"
      : "border-line bg-card text-ink hover:bg-card-hover"
  }`;
}
