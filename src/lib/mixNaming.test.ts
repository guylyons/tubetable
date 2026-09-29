import { describe, expect, test } from "bun:test";
import type { MixChannel } from "../types";
import { deriveMixName } from "./mixNaming";

function channelTitled(title: string): MixChannel {
  return {
    id: title,
    video: { videoId: title, title, channelTitle: "Channel", thumbnail: "thumb.jpg" },
    volume: 50,
    muted: false,
    solo: false,
    paused: false,
    looped: true,
    progressSeconds: 0,
  };
}

describe("deriveMixName", () => {
  test("names an empty mix", () => {
    expect(deriveMixName([])).toBe("Untitled Blue Mix");
  });

  test("falls back to a track count when every word is filler", () => {
    expect(deriveMixName([channelTitled("Lofi Beats to Study")])).toBe("1-Track Blue Mix");
  });

  test("uses one keyword as a room", () => {
    expect(deriveMixName([channelTitled("Thunder")])).toBe("Thunder Room");
  });

  test("uses two keywords as a session", () => {
    expect(deriveMixName([channelTitled("Rain Sounds")])).toBe("Rain Sounds Session");
  });

  test("uses the top three keywords, weighting earlier words", () => {
    expect(deriveMixName([channelTitled("Brian Eno - Ambient 1: Music for Airports")])).toBe("Brian Eno Ambient Mix");
  });

  test("weights earlier channels above later ones", () => {
    expect(deriveMixName([channelTitled("Ocean"), channelTitled("Forest")])).toBe("Ocean Forest Session");
    expect(deriveMixName([channelTitled("Forest"), channelTitled("Ocean")])).toBe("Forest Ocean Session");
  });

  test("adds up repeated words across channels and breaks ties alphabetically", () => {
    expect(deriveMixName([channelTitled("Birds Morning"), channelTitled("Forest Birds")])).toBe(
      "Birds Forest Morning Mix",
    );
  });
});
