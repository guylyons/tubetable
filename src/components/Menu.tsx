import { EllipsisVertical, type LucideIcon } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { iconButtonClassName } from "./ui";

export type MenuItem = {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  checked?: boolean;
  disabled?: boolean;
  danger?: boolean;
};

type MenuProps = {
  label: string;
  items: MenuItem[];
  buttonClassName?: string;
};

export function Menu({ label, items, buttonClassName = "" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function menuItems() {
    return [
      ...(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? []),
    ];
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) {
      buttonRef.current?.focus();
    }
  }

  // Fixed positioning keeps the menu from being clipped by scrolling lists. It opens upward
  // when there is no room below, e.g. on the channel cards at the bottom of the page.
  useLayoutEffect(() => {
    if (!open || !menuRef.current || !buttonRef.current) {
      setPosition(null);
      return;
    }

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const { offsetWidth: menuWidth, offsetHeight: menuHeight } = menuRef.current;
    const fitsBelow = buttonRect.bottom + menuHeight + 8 <= window.innerHeight;
    setPosition({
      top: fitsBelow || buttonRect.top < menuHeight + 8 ? buttonRect.bottom + 4 : buttonRect.top - menuHeight - 4,
      left: Math.max(8, Math.min(buttonRect.right - menuWidth, window.innerWidth - menuWidth - 8)),
    });
  }, [open]);

  // Focus once placed: the menu is hidden until then, and hidden elements cannot take focus.
  useEffect(() => {
    if (open && position) {
      menuItems()[0]?.focus();
    }
  }, [open, position === null]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        close(false);
      }
    }

    // The menu is placed once, so close it rather than let it drift when the page moves.
    const handleViewportChange = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        close(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const focusable = menuItems();
    const index = focusable.indexOf(document.activeElement as HTMLElement);

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusable[(index + 1) % focusable.length]?.focus();
        break;
      case "ArrowUp":
        event.preventDefault();
        focusable[(index - 1 + focusable.length) % focusable.length]?.focus();
        break;
      case "Home":
        event.preventDefault();
        focusable[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        focusable.at(-1)?.focus();
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case "Tab":
        close(false);
        break;
    }
  }

  function select(item: MenuItem) {
    if (item.disabled) {
      return;
    }

    close();
    item.onSelect();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(current => !current)}
        onKeyDown={event => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`${iconButtonClassName} ${buttonClassName}`}
      >
        <EllipsisVertical size={18} aria-hidden="true" />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          style={position ?? { top: 0, left: 0, visibility: "hidden" }}
          className="fixed z-50 min-w-48 rounded-lg border border-line bg-card p-1 text-sm text-ink shadow-xl"
        >
          {items.map(item => {
            const Icon = item.icon;
            const isCheckbox = item.checked !== undefined;

            return (
              <button
                key={item.label}
                type="button"
                role={isCheckbox ? "menuitemcheckbox" : "menuitem"}
                aria-checked={isCheckbox ? item.checked : undefined}
                aria-disabled={item.disabled || undefined}
                tabIndex={-1}
                onClick={() => select(item)}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left outline-none hover:bg-black/8 focus-visible:bg-black/10 aria-disabled:cursor-not-allowed aria-disabled:opacity-45 ${
                  item.danger ? "text-danger" : ""
                }`}
              >
                {Icon ? <Icon size={16} aria-hidden="true" className="shrink-0" /> : null}
                <span className="flex-1">{item.label}</span>
                {isCheckbox ? (
                  <span aria-hidden="true" className={item.checked ? "opacity-100" : "opacity-0"}>
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
