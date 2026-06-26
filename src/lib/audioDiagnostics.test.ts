import { describe, expect, test } from "bun:test";

import {
  AUDIO_DIAGNOSTICS_LIMIT,
  createAudioDiagnostics,
} from "./audioDiagnostics";

describe("audio diagnostics", () => {
  test("does not record entries when disabled", () => {
    const diagnostics = createAudioDiagnostics({
      enabled: false,
      label: "Track A",
      now: () => 123,
    });

    diagnostics.record("play-request", { readyState: 4 });

    expect(diagnostics.entries).toEqual([]);
  });

  test("records timestamped entries while keeping the newest bounded history", () => {
    let now = 1000;
    const diagnostics = createAudioDiagnostics({
      enabled: true,
      label: "Track A",
      now: () => now,
      limit: 2,
    });

    diagnostics.record("load", { currentTime: 0 });
    now += 16;
    diagnostics.record("waiting", { readyState: 2 });
    now += 32;
    diagnostics.record("set-effects", {
      delayEnabled: true,
      reverbEnabled: false,
      lofiEnabled: false,
      pitchShiftEnabled: false,
    });

    expect(diagnostics.entries).toEqual([
      {
        eventName: "waiting",
        label: "Track A",
        timestampMs: 1016,
        data: { readyState: 2 },
      },
      {
        eventName: "set-effects",
        label: "Track A",
        timestampMs: 1048,
        data: {
          delayEnabled: true,
          reverbEnabled: false,
          lofiEnabled: false,
          pitchShiftEnabled: false,
        },
      },
    ]);
  });

  test("uses the default history limit", () => {
    const diagnostics = createAudioDiagnostics({
      enabled: true,
      label: "Track A",
      now: () => 0,
    });

    for (let index = 0; index < AUDIO_DIAGNOSTICS_LIMIT + 3; index += 1) {
      diagnostics.record("tick", { index });
    }

    expect(diagnostics.entries).toHaveLength(AUDIO_DIAGNOSTICS_LIMIT);
    expect(diagnostics.entries[0]?.data).toEqual({ index: 3 });
  });
});
