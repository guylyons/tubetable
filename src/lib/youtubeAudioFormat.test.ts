import { describe, expect, test } from "bun:test";
import { buildYtDlpAudioUrlArgs } from "./youtubeAudioFormat";

describe("YouTube audio format selection", () => {
  test("falls back to a low-bandwidth playable stream when audio-only formats are unavailable", () => {
    const args = buildYtDlpAudioUrlArgs("X4VbdwhkE10");

    expect(args).toContain("-f");
    expect(args).toContain("ba[ext=m4a]/ba/worst[acodec!=none]");
  });
});
