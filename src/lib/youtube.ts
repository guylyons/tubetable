export type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  getIframe?: () => HTMLIFrameElement;
  getPlayerState?: () => number;
  mute: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setVolume: (volume: number) => void;
  unMute: () => void;
};

type YouTubePlayerOptions = {
  events?: {
    onReady?: (event: { target: YouTubePlayer }) => void;
    onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
  };
  height?: string;
  playerVars?: Record<string, number | string>;
  videoId: string;
  width?: string;
};

type YouTubeNamespace = {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_PLAYER_STATE_UNSTARTED = -1;
export const YT_PLAYER_STATE_ENDED = 0;
export const YT_PLAYER_STATE_PAUSED = 2;
const YT_PLAYER_STATE_PLAYING = 1;
const YT_PLAYER_STATE_BUFFERING = 3;
const YT_PLAYER_STATE_CUED = 5;

let iframeApiPromise: Promise<YouTubeNamespace> | null = null;

export function createYouTubePlayerVars(startSeconds: number) {
  return {
    autoplay: 0,
    controls: 1,
    disablekb: 1,
    enablejsapi: 1,
    fs: 0,
    iv_load_policy: 3,
    loop: 0,
    modestbranding: 1,
    playsinline: 1,
    rel: 0,
    start: Math.floor(Math.max(0, startSeconds)),
  };
}

export function getSeekSecondsFromProgressValue(
  progressValue: string,
  durationSeconds: number,
  fallbackSeconds = 0,
) {
  const progressPercent = Number(progressValue);
  if (
    !Number.isFinite(progressPercent) ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return Math.max(0, fallbackSeconds);
  }

  const clampedPercent = Math.min(100, Math.max(0, progressPercent));
  return (clampedPercent / 100) * durationSeconds;
}

export function getSeekSecondsFromPointerPosition(
  clientX: number,
  trackLeft: number,
  trackWidth: number,
  durationSeconds: number,
  fallbackSeconds = 0,
) {
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(trackLeft) ||
    !Number.isFinite(trackWidth) ||
    trackWidth <= 0 ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return Math.max(0, fallbackSeconds);
  }

  const progressPercent = ((clientX - trackLeft) / trackWidth) * 100;
  return getSeekSecondsFromProgressValue(
    String(progressPercent),
    durationSeconds,
    fallbackSeconds,
  );
}

function sanitizeVideoId(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return /^[\w-]{11}$/.test(trimmed) ? trimmed : null;
}

export function loadIframeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube iframe API is only available in the browser."));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (iframeApiPromise) {
    return iframeApiPromise;
  }

  iframeApiPromise = new Promise((resolve, reject) => {
    const previousHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousHandler?.();

      if (window.YT?.Player) {
        resolve(window.YT);
        return;
      }

      reject(new Error("The YouTube iframe API loaded without a Player constructor."));
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load the YouTube iframe API."));
    document.head.appendChild(script);
  });

  return iframeApiPromise;
}

export function parseYouTubeVideoId(input: string) {
  const trimmed = input.trim();
  const directId = sanitizeVideoId(trimmed);

  if (directId) {
    return directId;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return sanitizeVideoId(url.pathname.slice(1));
    }

    if (!host.endsWith("youtube.com") && !host.endsWith("youtube-nocookie.com")) {
      return null;
    }

    const watchedId = sanitizeVideoId(url.searchParams.get("v"));
    if (watchedId) {
      return watchedId;
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts.length < 2) {
      return null;
    }

    const [prefix, id] = pathParts;
    if (["embed", "shorts", "live", "v"].includes(prefix ?? "")) {
      return sanitizeVideoId(id);
    }
  } catch {
    return null;
  }

  return null;
}

export function applyPlayerVolume(player: YouTubePlayer, volume: number) {
  player.setVolume(volume);

  if (volume === 0) {
    player.mute();
    return;
  }

  player.unMute();
}

export function lockPlayerInteraction(player: YouTubePlayer) {
  const iframe = player.getIframe?.();

  if (!iframe) {
    return;
  }

  iframe.tabIndex = -1;
  iframe.setAttribute("title", "YouTube video preview controlled by TubeTable");
  iframe.style.pointerEvents = "none";
}

export function syncPlayerPlayback(player: YouTubePlayer, shouldPlay: boolean) {
  const currentState = player.getPlayerState?.();

  try {
    if (shouldPlay) {
      if (currentState === YT_PLAYER_STATE_PLAYING || currentState === YT_PLAYER_STATE_BUFFERING) {
        return;
      }

      player.playVideo();
      return;
    }

    if (
      currentState === YT_PLAYER_STATE_PAUSED ||
      currentState === YT_PLAYER_STATE_CUED ||
      currentState === YT_PLAYER_STATE_UNSTARTED
    ) {
      return;
    }

    player.pauseVideo();
  } catch {
    // The YouTube iframe can briefly reject commands during state transitions.
  }
}
