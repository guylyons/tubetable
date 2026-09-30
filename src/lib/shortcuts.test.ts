import { describe, expect, test } from "bun:test";
import { getShortcutAction } from "./shortcuts";

function press(key: string, overrides: Partial<Parameters<typeof getShortcutAction>[0]> = {}) {
  return getShortcutAction({ key, altKey: false, ctrlKey: false, metaKey: false, targetTag: "BODY", ...overrides });
}

describe("getShortcutAction", () => {
  test("maps the documented keys", () => {
    expect(press(" ")).toEqual({ type: "togglePlayAll" });
    expect(press("3")).toEqual({ type: "focusChannel", index: 2 });
    expect(press("m")).toEqual({ type: "toggleMuteFocused" });
    expect(press("S")).toEqual({ type: "toggleSoloFocused" });
    expect(press("f")).toEqual({ type: "toggleStage" });
    expect(press("/")).toEqual({ type: "focusSearch" });
  });

  test("ignores keys typed into fields", () => {
    for (const targetTag of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(press("m", { targetTag })).toBeNull();
    }
    expect(press("m", { targetIsEditable: true })).toBeNull();
  });

  test("leaves Space to a button reached by keyboard, so it presses that button", () => {
    expect(press(" ", { targetTag: "BUTTON", targetFocusedByKeyboard: true })).toBeNull();
    expect(press("m", { targetTag: "BUTTON", targetFocusedByKeyboard: true })).toEqual({ type: "toggleMuteFocused" });
  });

  test("keeps Space as play/pause when a button only kept focus after a mouse click", () => {
    expect(press(" ", { targetTag: "BUTTON", targetFocusedByKeyboard: false })).toEqual({ type: "togglePlayAll" });
  });

  test("stays out of open menus and dialogs, which handle their own keys", () => {
    expect(press(" ", { targetTag: "BUTTON", targetInPopup: true })).toBeNull();
    expect(press("m", { targetInPopup: true })).toBeNull();
  });

  test("ignores keys held with a modifier and channels past five", () => {
    expect(press("m", { metaKey: true })).toBeNull();
    expect(press("s", { ctrlKey: true })).toBeNull();
    expect(press("6")).toBeNull();
    expect(press("0")).toBeNull();
  });
});
