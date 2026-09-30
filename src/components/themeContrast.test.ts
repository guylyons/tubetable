import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getChannelColor } from "../lib/mixChannels";

const css = readFileSync(join(import.meta.dir, "..", "index.css"), "utf8");

function readTokens(selector: string) {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--tt-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(match => [match[1], match[2]]));
}

const grey = readTokens(":root");
const themes: Record<string, Record<string, string>> = {
  grey,
  dark: { ...grey, ...readTokens(':root[data-theme="dark"]') },
  light: { ...grey, ...readTokens(':root[data-theme="light"]') },
};

function luminance(hex: string) {
  const [red, green, blue] = [1, 3, 5]
    .map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

// Text that sits on each surface, checked against WCAG AA for normal-size text.
const TEXT_PAIRS = [
  ["fg", "app"],
  ["fg", "bar"],
  ["fg-muted", "app"],
  ["fg-muted", "bar"],
  ["ink", "panel"],
  ["ink", "card"],
  ["ink-muted", "panel"],
  ["ink-muted", "card"],
  ["ink-muted", "card-hover"],
  ["accent-ink", "accent"],
  ["field-ink", "field"],
  ["field-muted", "field"],
  ["danger", "card"],
] as const;

const SURFACES = ["app", "bar", "panel", "card"] as const;

describe.each(Object.entries(themes))("%s theme contrast", (_, tokens) => {
  test.each(TEXT_PAIRS)("%s text on %s meets 4.5:1", (text, surface) => {
    expect(contrast(tokens[text]!, tokens[surface]!)).toBeGreaterThanOrEqual(4.5);
  });

  // The ring is two-tone, so one of its rings must stand out from whatever it surrounds.
  for (const surface of SURFACES) {
    test(`the focus ring stands out 3:1 on ${surface}`, () => {
      const best = Math.max(
        contrast(tokens.focus!, tokens[surface]!),
        contrast(tokens["focus-inner"]!, tokens[surface]!),
      );
      expect(best).toBeGreaterThanOrEqual(3);
    });
  }

  test("the slider thumb stands out 3:1 from its track, by its fill or its edge", () => {
    const best = Math.max(contrast(tokens.thumb!, tokens.well!), contrast(tokens["thumb-edge"]!, tokens.well!));
    expect(best).toBeGreaterThanOrEqual(3);
  });
});

describe("channel colors", () => {
  test.each([0, 1, 2, 3, 4])("channel %i header text meets 4.5:1", index => {
    expect(contrast("#1b1b1c", getChannelColor(index))).toBeGreaterThanOrEqual(4.5);
  });
});
