import { describe, expect, test } from "bun:test";
import { shouldReloadAudioForSync } from "./trackAudio";

describe("track audio sync", () => {
  test("does not reload while the media element is still loading after autoplay", () => {
    expect(
      shouldReloadAudioForSync({
        currentTime: 0,
        isPaused: false,
        readyState: 0,
        referenceSeconds: 13.6,
        toleranceSeconds: 0.35,
      }),
    ).toBe(false);
  });

  test("does not reload ready media just because proxy startup leaves it behind", () => {
    expect(
      shouldReloadAudioForSync({
        currentTime: 8,
        isPaused: false,
        readyState: 2,
        referenceSeconds: 10,
        toleranceSeconds: 0.35,
      }),
    ).toBe(false);
  });

  test("reloads playing ready media when it runs ahead beyond tolerance", () => {
    expect(
      shouldReloadAudioForSync({
        currentTime: 12,
        isPaused: false,
        readyState: 2,
        referenceSeconds: 10,
        toleranceSeconds: 0.35,
      }),
    ).toBe(true);
  });
});
