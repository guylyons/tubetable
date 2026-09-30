import { describe, expect, test } from "bun:test";
import { getPlayerFrame } from "./playerFrame";

describe("getPlayerFrame", () => {
  test("covers a slot wider than 16:9 and pushes YouTube's title and bottom bars out of view", () => {
    const frame = getPlayerFrame(1600, 500);

    // 16:9 at 1600 wide is 900 tall, plus 64px of chrome crop above and below.
    expect(frame).toEqual({ top: -264, height: 1028 });
  });

  test("keeps a 16:9 slot's video exactly in view, cropping only the chrome", () => {
    expect(getPlayerFrame(1280, 720)).toEqual({ top: -64, height: 848 });
  });

  test("uses a smaller crop for card thumbnails, where YouTube's chrome is smaller", () => {
    expect(getPlayerFrame(144, 81)).toEqual({ top: -12, height: 105 });
  });

  test("letterboxes a slot taller than 16:9 instead of cropping the picture", () => {
    expect(getPlayerFrame(400, 400)).toEqual({ top: -24, height: 448 });
  });
});
