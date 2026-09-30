import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { MixChannelState, PlayerStatus } from "../types";
import {
  applyPlayerVolume,
  createYouTubePlayerVars,
  getPlayerStatus,
  loadIframeApi,
  syncPlayerPlayback,
  YT_PLAYER_STATE_ENDED,
  YT_PLAYER_STATE_PAUSED,
  YT_PLAYER_STATE_PLAYING,
  type YouTubePlayer,
} from "../lib/youtube";
import { getPlayerFrame } from "../lib/playerFrame";

export type PlayerRegistry = Map<string, YouTubePlayer>;

type PlayerCallbacks = {
  onDuration: (mixKey: string, channelId: string, durationSeconds: number) => void;
  onProgress: (mixKey: string, channelId: string, progressSeconds: number) => void;
  onStatus: (channelId: string, status: PlayerStatus) => void;
};

type PlayerLayerProps = PlayerCallbacks & {
  channels: MixChannelState[];
  mixKey: string;
  players: PlayerRegistry;
  stageChannelId: string | null;
  stageExpanded: boolean;
};

type SlotRect = { top: number; left: number; width: number; height: number; radius: string };

// Slots are ordinary elements marked with data-player-slot="<channel id>". The stage marks
// the focused channel and each card marks its own thumbnail.
export const PLAYER_SLOT_ATTRIBUTE = "data-player-slot";

function sameRects(left: Record<string, SlotRect>, right: Record<string, SlotRect>) {
  const leftKeys = Object.keys(left);
  return (
    leftKeys.length === Object.keys(right).length &&
    leftKeys.every(key => {
      const a = left[key]!;
      const b = right[key];
      return (
        b &&
        a.top === b.top &&
        a.left === b.left &&
        a.width === b.width &&
        a.height === b.height &&
        a.radius === b.radius
      );
    })
  );
}

/**
 * Hosts one YouTube iframe per channel and lays each over its slot. The iframes never move in
 * the DOM, because moving an iframe reloads it and would cut the audio whenever focus changes.
 */
export function PlayerLayer({
  channels,
  mixKey,
  players,
  stageChannelId,
  stageExpanded,
  ...callbacks
}: PlayerLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<Record<string, SlotRect>>({});
  const measureRef = useRef<() => void>(() => undefined);

  measureRef.current = () => {
    const layer = layerRef.current;
    if (!layer) {
      return;
    }

    const origin = layer.getBoundingClientRect();
    const next: Record<string, SlotRect> = {};
    for (const slot of document.querySelectorAll<HTMLElement>(`[${PLAYER_SLOT_ATTRIBUTE}]`)) {
      const channelId = slot.getAttribute(PLAYER_SLOT_ATTRIBUTE);
      const box = slot.getBoundingClientRect();
      if (!channelId || box.width === 0 || box.height === 0) {
        continue;
      }

      next[channelId] = {
        top: Math.round(box.top - origin.top),
        left: Math.round(box.left - origin.left),
        width: Math.round(box.width),
        height: Math.round(box.height),
        radius: getComputedStyle(slot).borderRadius,
      };
    }

    setRects(current => (sameRects(current, next) ? current : next));
  };

  // Re-measure after every render, since focus changes, new channels and panel edits all move slots.
  useLayoutEffect(() => {
    measureRef.current();
  });

  useEffect(() => {
    const measure = () => measureRef.current();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    const slotObserver = new MutationObserver(() => {
      observer.disconnect();
      observer.observe(document.body);
      document.querySelectorAll(`[${PLAYER_SLOT_ATTRIBUTE}]`).forEach(slot => observer.observe(slot));
      measure();
    });
    slotObserver.observe(document.body, { subtree: true, childList: true, attributeFilter: [PLAYER_SLOT_ATTRIBUTE] });
    document.querySelectorAll(`[${PLAYER_SLOT_ATTRIBUTE}]`).forEach(slot => observer.observe(slot));
    window.addEventListener("resize", measure);
    // Capture scrolls of inner containers too; page scroll moves slots and layer together.
    window.addEventListener("scroll", measure, true);

    return () => {
      observer.disconnect();
      slotObserver.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, []);

  // Sorted by id, not channel order: if React moved an iframe to follow a reorder, the iframe
  // would reload and drop its connection to the YouTube API.
  const playerOrder = [...channels].sort((left, right) => left.id.localeCompare(right.id));

  return (
    <div
      ref={layerRef}
      // Above the expanded stage's backdrop (z-5), below every control (z-20 and up).
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      {playerOrder.map(channel => {
        const onStage = channel.id === stageChannelId;

        return (
          <ChannelPlayer
            key={`${mixKey}:${channel.id}`}
            {...callbacks}
            channel={channel}
            mixKey={mixKey}
            players={players}
            rect={rects[channel.id]}
            hidden={stageExpanded && !onStage}
            dimmed={channel.silencedBy !== null && !onStage}
          />
        );
      })}
    </div>
  );
}

type ChannelPlayerProps = PlayerCallbacks & {
  channel: MixChannelState;
  dimmed: boolean;
  hidden: boolean;
  mixKey: string;
  players: PlayerRegistry;
  rect: SlotRect | undefined;
};

function readPlayerTimes(player: YouTubePlayer | null) {
  const currentTime = player?.getCurrentTime?.();
  const duration = player?.getDuration?.();

  return {
    currentTime: typeof currentTime === "number" && Number.isFinite(currentTime) ? Math.max(0, currentTime) : null,
    duration: typeof duration === "number" && Number.isFinite(duration) && duration > 0 ? duration : null,
  };
}

function ChannelPlayer({
  channel,
  dimmed,
  hidden,
  mixKey,
  players,
  rect,
  onDuration,
  onProgress,
  onStatus,
}: ChannelPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [ready, setReady] = useState(false);
  // Until a video first plays, YouTube shows its own cued screen (title, big play button).
  // The slot's thumbnail shows through instead.
  const [hasPlayed, setHasPlayed] = useState(false);
  const shouldPlay = !channel.paused;
  const latest = useRef({ channel, shouldPlay, onDuration, onProgress, onStatus });
  latest.current = { channel, shouldPlay, onDuration, onProgress, onStatus };

  // Reports under the mix key the player was created for, so a player torn down by a
  // session switch does not write into the next session.
  function reportTimes() {
    const { currentTime, duration } = readPlayerTimes(playerRef.current);
    const { channel: current, onDuration: reportDuration, onProgress: reportProgress } = latest.current;
    if (currentTime !== null) {
      reportProgress(mixKey, current.id, currentTime);
    }
    if (duration !== null && Math.abs(duration - current.durationSeconds) >= 1) {
      reportDuration(mixKey, current.id, Math.round(duration));
    }
  }

  useEffect(() => {
    let disposed = false;
    setReady(false);
    setHasPlayed(false);
    latest.current.onStatus(channel.id, "loading");

    loadIframeApi()
      .then(YT => {
        if (disposed || !containerRef.current) {
          return;
        }

        playerRef.current = new YT.Player(containerRef.current, {
          width: "100%",
          height: "100%",
          videoId: channel.video.videoId,
          // `start` resumes the saved position. Seeking on load instead would start a cued video.
          playerVars: {
            ...createYouTubePlayerVars(latest.current.channel.progressSeconds),
            origin: window.location.origin,
          },
          events: {
            onReady: event => {
              if (disposed) {
                return;
              }

              players.set(channel.id, event.target);
              applyPlayerVolume(event.target, latest.current.channel.effectiveVolume);
              syncPlayerPlayback(event.target, latest.current.shouldPlay);
              latest.current.onStatus(channel.id, "paused");
              setReady(true);
              reportTimes();
            },
            onStateChange: event => {
              if (disposed) {
                return;
              }

              const { channel: current, shouldPlay: playing } = latest.current;
              if (event.data === YT_PLAYER_STATE_ENDED && current.looped && playing) {
                try {
                  event.target.seekTo(0, true);
                  event.target.playVideo();
                } catch {
                  // The YouTube iframe can briefly reject restart commands during state transitions.
                }
                return;
              }

              latest.current.onStatus(channel.id, getPlayerStatus(event.data));
              if (event.data === YT_PLAYER_STATE_PLAYING) {
                setHasPlayed(true);
              }
              if (event.data === YT_PLAYER_STATE_PAUSED || event.data === YT_PLAYER_STATE_ENDED) {
                reportTimes();
              }
            },
            onError: () => {
              if (!disposed) {
                latest.current.onStatus(channel.id, "error");
              }
            },
          },
        });
      })
      .catch(() => {
        if (!disposed) {
          latest.current.onStatus(channel.id, "error");
        }
      });

    return () => {
      disposed = true;
      reportTimes();
      players.delete(channel.id);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [channel.id, channel.video.videoId, mixKey]);

  useEffect(() => {
    if (ready && playerRef.current) {
      applyPlayerVolume(playerRef.current, channel.effectiveVolume);
    }
  }, [channel.effectiveVolume, ready]);

  useEffect(() => {
    if (ready && playerRef.current) {
      syncPlayerPlayback(playerRef.current, shouldPlay);
    }
  }, [ready, shouldPlay]);

  useEffect(() => {
    if (!ready || !shouldPlay) {
      return undefined;
    }

    reportTimes();
    const intervalId = window.setInterval(reportTimes, 1000);
    return () => {
      window.clearInterval(intervalId);
      reportTimes();
    };
  }, [ready, shouldPlay]);

  const style: CSSProperties = rect
    ? {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        borderRadius: rect.radius,
        visibility: hidden ? "hidden" : "visible",
        opacity: !hasPlayed ? 0 : dimmed ? 0.45 : 1,
      }
    : // No slot on screen: keep playing, out of sight.
      { top: 0, left: -10000, width: 320, height: 180, visibility: "hidden" };
  const frame = getPlayerFrame(rect?.width ?? 320, rect?.height ?? 180);

  return (
    <div
      className="absolute overflow-hidden transition-[top,left,width,height,opacity] duration-200 ease-out motion-reduce:transition-none"
      style={style}
      data-channel-player={channel.id}
    >
      {/* The app's own controls drive playback, so the iframe's buttons stay out of reach. */}
      <div inert className="absolute inset-x-0 bg-black" style={{ top: frame.top, height: frame.height }}>
        <div ref={containerRef} />
      </div>
    </div>
  );
}
