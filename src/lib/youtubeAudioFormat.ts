const YT_WATCH_URL = (videoId: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
const AUDIO_FORMAT_SELECTOR = "ba[ext=m4a]/ba/worst[acodec!=none]";

export function buildYtDlpAudioUrlArgs(videoId: string) {
  return ["yt-dlp", "--no-playlist", "-f", AUDIO_FORMAT_SELECTOR, "-g", YT_WATCH_URL(videoId)];
}
