import type { MixChannel } from "../types";

const TITLE_STOP_WORDS = new Set([
  "a",
  "all",
  "and",
  "as",
  "at",
  "audio",
  "beats",
  "best",
  "bgm",
  "by",
  "chill",
  "for",
  "from",
  "full",
  "in",
  "instrumental",
  "live",
  "loop",
  "lofi",
  "mix",
  "music",
  "of",
  "on",
  "original",
  "radio",
  "relax",
  "relaxing",
  "study",
  "the",
  "to",
  "track",
  "version",
  "video",
  "with",
]);

function titleCase(value: string) {
  return value.replace(/\b\w/g, match => match.toUpperCase());
}

export function deriveMixName(channels: MixChannel[]) {
  if (channels.length === 0) {
    return "Untitled Blue Mix";
  }

  const weightedWords = new Map<string, number>();

  channels.forEach((channel, channelIndex) => {
    const words = channel.video.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(word => word.length >= 3 && !TITLE_STOP_WORDS.has(word));

    words.forEach((word, wordIndex) => {
      const weight = 6 - Math.min(wordIndex, 5) + (channels.length - channelIndex);
      weightedWords.set(word, (weightedWords.get(word) ?? 0) + weight);
    });
  });

  const rankedWords = [...weightedWords.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([word]) => word);

  const primary = rankedWords[0];
  const secondary = rankedWords.find(word => word !== primary);
  const tertiary = rankedWords.find(word => word !== primary && word !== secondary);

  if (!primary) {
    return `${channels.length}-Track Blue Mix`;
  }

  if (!secondary) {
    return `${titleCase(primary)} Room`;
  }

  if (!tertiary) {
    return `${titleCase(primary)} ${titleCase(secondary)} Session`;
  }

  return `${titleCase(primary)} ${titleCase(secondary)} ${titleCase(tertiary)} Mix`;
}
