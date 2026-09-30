import { MAX_CHANNELS } from "../types";

export type ShortcutAction =
  | { type: "togglePlayAll" }
  | { type: "focusChannel"; index: number }
  | { type: "toggleMuteFocused" }
  | { type: "toggleSoloFocused" }
  | { type: "toggleStage" }
  | { type: "focusSearch" };

type ShortcutKeyEvent = {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  targetTag: string;
  targetIsEditable?: boolean;
  targetFocusedByKeyboard?: boolean;
  targetInPopup?: boolean;
};

export const SHORTCUTS = [
  { keys: "Space", label: "Play / pause all" },
  { keys: `1–${MAX_CHANNELS}`, label: "Focus a channel" },
  { keys: "M", label: "Mute focused channel" },
  { keys: "S", label: "Solo focused channel" },
  { keys: "F", label: "Expand the stage" },
  { keys: "/", label: "Search YouTube" },
] as const;

const FIELD_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function getShortcutAction(event: ShortcutKeyEvent): ShortcutAction | null {
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.targetIsEditable ||
    event.targetInPopup ||
    FIELD_TAGS.has(event.targetTag)
  ) {
    return null;
  }

  const key = event.key.toLowerCase();

  if (key === " ") {
    // Space presses a button reached by keyboard. A button that merely kept focus after a
    // click should not swallow the transport key, as in a DAW.
    return event.targetTag === "BUTTON" && event.targetFocusedByKeyboard ? null : { type: "togglePlayAll" };
  }

  const channelNumber = Number(key);
  if (Number.isInteger(channelNumber) && channelNumber >= 1 && channelNumber <= MAX_CHANNELS) {
    return { type: "focusChannel", index: channelNumber - 1 };
  }

  switch (key) {
    case "m":
      return { type: "toggleMuteFocused" };
    case "s":
      return { type: "toggleSoloFocused" };
    case "f":
      return { type: "toggleStage" };
    case "/":
      return { type: "focusSearch" };
    default:
      return null;
  }
}
