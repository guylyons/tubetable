import { X } from "lucide-react";
import { useEffect } from "react";
import { iconButtonClassName } from "./ui";

export type ToastMessage = {
  id: number;
  message: string;
  undo?: () => void;
};

type ToastProps = {
  onDismiss: () => void;
  toast: ToastMessage | null;
};

const TOAST_MS = 3000;
const UNDO_TOAST_MS = 8000;

export function Toast({ onDismiss, toast }: ToastProps) {
  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(onDismiss, toast.undo ? UNDO_TOAST_MS : TOAST_MS);
    return () => window.clearTimeout(timeoutId);
  }, [toast?.id]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-12 z-50 flex justify-center px-4" role="status">
      {toast ? (
        <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border border-line bg-card py-2 pl-4 pr-2 text-sm text-ink shadow-2xl">
          <span className="min-w-0 flex-1">{toast.message}</span>
          {toast.undo ? (
            <button
              type="button"
              onClick={() => {
                toast.undo?.();
                onDismiss();
              }}
              className="cursor-pointer rounded-md px-2 py-1 font-semibold underline-offset-2 hover:underline"
            >
              Undo
            </button>
          ) : null}
          <button type="button" onClick={onDismiss} aria-label="Dismiss" className={iconButtonClassName}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
