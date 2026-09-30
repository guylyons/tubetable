import { Settings, SlidersVertical } from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { SHORTCUTS } from "../lib/shortcuts";
import { SearchBar } from "./SearchBar";
import { eyebrowClassName, iconButtonClassName } from "./ui";

export const THEMES = [
  { value: "grey", label: "Grey" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

export type ThemeMode = (typeof THEMES)[number]["value"];

type TopBarProps = ComponentProps<typeof SearchBar> & {
  onChangeTheme: (theme: ThemeMode) => void;
  theme: ThemeMode;
};

function SettingsPopover({ onChangeTheme, theme }: Pick<TopBarProps, "onChangeTheme" | "theme">) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    panelRef.current?.querySelector<HTMLElement>("input:checked")?.focus();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(current => !current)}
        className={`${iconButtonClassName} h-10 w-10 text-fg hover:bg-white/10`}
      >
        <Settings size={20} aria-hidden="true" />
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Settings"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-xl border border-line bg-card p-4 text-ink shadow-2xl"
        >
          <fieldset>
            <legend className={`${eyebrowClassName} mb-2 text-ink-muted`}>Theme</legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-panel p-1">
              {THEMES.map(option => (
                <label
                  key={option.value}
                  className="cursor-pointer rounded-md px-2 py-1.5 text-center text-sm font-medium transition has-checked:bg-accent has-checked:text-accent-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus has-focus-visible:shadow-[0_0_0_2px_var(--tt-focus-inner)]"
                >
                  <input
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={theme === option.value}
                    onChange={() => onChangeTheme(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <h2 className={`${eyebrowClassName} mb-2 mt-5 text-ink-muted`}>Keyboard shortcuts</h2>
          <dl className="space-y-1.5 text-sm">
            {SHORTCUTS.map(shortcut => (
              <div key={shortcut.keys} className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">{shortcut.label}</dt>
                <dd>
                  <kbd className="rounded border border-line bg-panel px-1.5 py-0.5 font-sans text-xs">
                    {shortcut.keys}
                  </kbd>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

export function TopBar({ onChangeTheme, theme, ...searchProps }: TopBarProps) {
  return (
    <header className="relative z-30 border-b border-line bg-bar">
      <div className="mx-auto flex max-w-[1760px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6 lg:flex-nowrap">
        <div className="flex items-center gap-3 text-fg">
          <SlidersVertical size={26} strokeWidth={2.25} aria-hidden="true" />
          <h1 className="text-xl font-bold tracking-tight">Tubetable</h1>
        </div>

        <SearchBar {...searchProps} className="order-last w-full lg:order-none lg:mx-auto lg:max-w-3xl lg:flex-1" />

        <div className="ml-auto lg:ml-0">
          <SettingsPopover onChangeTheme={onChangeTheme} theme={theme} />
        </div>
      </div>
    </header>
  );
}
