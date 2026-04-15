import { serve } from "bun";
import index from "./index.html";
import { fetchYouTubeSearchPayload, resolveVideoMetadata } from "../netlify/functions/_shared/youtubeApi";

type YouTubeSearchPayload = {
  results: Array<{
    videoId: string;
    title: string;
    channelTitle: string;
    durationText?: string;
    viewCountText?: string;
    thumbnail: string;
  }>;
  suggestions: string[];
};

type AudioStreamCacheEntry = {
  expiresAt: number;
  url: string;
};

type WaveformCacheEntry = {
  expiresAt: number;
  body: Uint8Array;
};

type WaveformDataCacheEntry = {
  expiresAt: number;
  payload: {
    durationSeconds: number;
    peaks: number[];
  };
};

const AUDIO_STREAM_CACHE_TTL_MS = 10 * 60 * 1000;
const audioStreamCache = new Map<string, AudioStreamCacheEntry>();
const waveformCache = new Map<string, WaveformCacheEntry>();
const waveformDataCache = new Map<string, WaveformDataCacheEntry>();
const WAVEFORM_CACHE_TTL_MS = 30 * 60 * 1000;
const YT_WATCH_URL = (videoId: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    headers: {
      "Cache-Control": "public, max-age=120, stale-while-revalidate=300",
    },
    ...init,
  });
}

function getCachedAudioUrl(videoId: string) {
  const cached = audioStreamCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const result = Bun.spawnSync({
    cmd: ["yt-dlp", "--no-playlist", "-f", "ba[ext=m4a]/ba", "-g", YT_WATCH_URL(videoId)],
    stderr: "pipe",
    stdout: "pipe",
  });

  if (result.exitCode !== 0) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new Error(stderr || "Could not resolve audio for that video.");
  }

  const url = new TextDecoder()
    .decode(result.stdout)
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean);

  if (!url) {
    throw new Error("Could not resolve audio for that video.");
  }

  audioStreamCache.set(videoId, {
    expiresAt: Date.now() + AUDIO_STREAM_CACHE_TTL_MS,
    url,
  });

  return url;
}

function getCachedWaveform(videoId: string) {
  const cached = waveformCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.body;
  }

  return null;
}

function setCachedWaveform(videoId: string, body: Uint8Array) {
  waveformCache.set(videoId, {
    expiresAt: Date.now() + WAVEFORM_CACHE_TTL_MS,
    body,
  });
}

function getCachedWaveformData(videoId: string) {
  const cached = waveformDataCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  return null;
}

function setCachedWaveformData(
  videoId: string,
  payload: { durationSeconds: number; peaks: number[] },
) {
  waveformDataCache.set(videoId, {
    expiresAt: Date.now() + WAVEFORM_CACHE_TTL_MS,
    payload,
  });
}

function parsePitchShiftSemitones(request: Request) {
  const url = new URL(request.url);
  const rawValue = url.searchParams.get("pitchShiftSemitones");
  if (rawValue === null) {
    return 0;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(12, Math.max(-12, value));
}

async function proxyAudioStream(request: Request, videoId: string) {
  console.info("[tubetable audio] request", { videoId });
  const pitchShiftSemitones = parsePitchShiftSemitones(request);
  const pitchShiftRatio = pitchShiftSemitones === 0 ? 1 : Math.pow(2, pitchShiftSemitones / 12);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const audioUrl = getCachedAudioUrl(videoId);
    console.info("[tubetable audio] transcode start", { videoId, attempt });
    const ffmpeg = Bun.spawn({
      cmd: [
        "ffmpeg",
        "-loglevel",
        "error",
        "-hide_banner",
        "-nostdin",
        "-user_agent",
        USER_AGENT,
        "-i",
        audioUrl,
        ...(pitchShiftSemitones === 0
          ? []
          : [
              "-af",
              `asetrate=44100*${pitchShiftRatio.toFixed(6)},atempo=${(1 / pitchShiftRatio).toFixed(6)}`,
            ]),
        "-vn",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-b:a",
        "192k",
        "-f",
        "mp3",
        "pipe:1",
      ],
      stderr: "pipe",
      stdout: "pipe",
    });

    const abortHandler = () => {
      try {
        ffmpeg.kill();
        console.info("[tubetable audio] request aborted", { videoId });
      } catch {
        // Ignore abort cleanup failures.
      }
    };

    request.signal.addEventListener("abort", abortHandler, { once: true });

    ffmpeg.exited
      .then(exitCode => {
        console.info("[tubetable audio] transcode exited", { videoId, exitCode });
      })
      .catch(error => {
        console.error("[tubetable audio] transcode wait failed", { videoId, error });
      });

    return new Response(ffmpeg.stdout, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "audio/mpeg",
      },
    });
  }

  return new Response("Unable to stream that audio.", { status: 502 });
}

async function generateWaveformImage(videoId: string) {
  const cached = getCachedWaveform(videoId);
  if (cached) {
    return cached;
  }

  const audioUrl = getCachedAudioUrl(videoId);
  const ffmpeg = Bun.spawn({
    cmd: [
      "ffmpeg",
      "-loglevel",
      "error",
      "-hide_banner",
      "-nostdin",
      "-user_agent",
      USER_AGENT,
      "-i",
      audioUrl,
      "-filter_complex",
      "showwavespic=s=1200x240:split_channels=0:colors=0x60a5fa",
      "-frames:v",
      "1",
      "-f",
      "image2",
      "pipe:1",
    ],
    stderr: "pipe",
    stdout: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(ffmpeg.stdout).arrayBuffer(),
    new Response(ffmpeg.stderr).text(),
    ffmpeg.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || "Could not generate waveform.");
  }

  const body = new Uint8Array(stdout);
  setCachedWaveform(videoId, body);
  return body;
}

async function generateWaveformData(videoId: string) {
  const cached = getCachedWaveformData(videoId);
  if (cached) {
    return cached;
  }

  const audioUrl = getCachedAudioUrl(videoId);
  const sampleRate = 11025;
  const bins = 1400;
  const ffmpeg = Bun.spawn({
    cmd: [
      "ffmpeg",
      "-loglevel",
      "error",
      "-hide_banner",
      "-nostdin",
      "-user_agent",
      USER_AGENT,
      "-i",
      audioUrl,
      "-vn",
      "-ac",
      "1",
      "-ar",
      String(sampleRate),
      "-f",
      "s16le",
      "pipe:1",
    ],
    stderr: "pipe",
    stdout: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(ffmpeg.stdout).arrayBuffer(),
    new Response(ffmpeg.stderr).text(),
    ffmpeg.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || "Could not generate waveform data.");
  }

  const samples = new Int16Array(stdout);
  if (samples.length === 0) {
    throw new Error("Waveform data was empty.");
  }

  const peaks = new Array<number>(bins).fill(0);
  const samplesPerBin = Math.max(1, Math.floor(samples.length / bins));

  for (let binIndex = 0; binIndex < bins; binIndex += 1) {
    const start = binIndex * samplesPerBin;
    const end =
      binIndex === bins - 1
        ? samples.length
        : Math.min(samples.length, start + samplesPerBin);

    let peak = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      peak = Math.max(peak, Math.abs(samples[sampleIndex] ?? 0) / 32768);
    }

    peaks[binIndex] = peak;
  }

  const payload = {
    durationSeconds: samples.length / sampleRate,
    peaks,
  };

  setCachedWaveformData(videoId, payload);
  return payload;
}

const server = serve({
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/api/youtube/search": {
      async GET(request) {
        const url = new URL(request.url);
        const query = url.searchParams.get("q")?.trim() ?? "";

        if (query.length < 2) {
          return json({ results: [], suggestions: [] } satisfies YouTubeSearchPayload);
        }

        try {
          const payload = await fetchYouTubeSearchPayload(query);
          return json(payload);
        } catch (error) {
          return json(
            {
              error: error instanceof Error ? error.message : "Search failed.",
              results: [],
              suggestions: [],
            },
            { status: 502 },
          );
        }
      },
    },

    "/api/youtube/video": {
      async GET(request) {
        const url = new URL(request.url);
        const videoId = url.searchParams.get("videoId")?.trim() ?? "";

        if (!/^[\w-]{11}$/.test(videoId)) {
          return json({ error: "A valid YouTube video ID is required." }, { status: 400 });
        }

        try {
          const result = await resolveVideoMetadata(videoId);
          return json({ result });
        } catch (error) {
          return json(
            {
              error: error instanceof Error ? error.message : "Could not resolve that video.",
            },
            { status: 502 },
          );
        }
      },
    },

    "/api/youtube/audio": {
      async GET(request) {
        const url = new URL(request.url);
        const videoId = url.searchParams.get("videoId")?.trim() ?? "";

        if (!/^[\w-]{11}$/.test(videoId)) {
          return new Response("A valid YouTube video ID is required.", { status: 400 });
        }

        try {
          return await proxyAudioStream(request, videoId);
        } catch (error) {
          return new Response(error instanceof Error ? error.message : "Could not resolve audio.", {
            status: 502,
          });
        }
      },
    },

    "/api/youtube/waveform": {
      async GET(request) {
        const url = new URL(request.url);
        const videoId = url.searchParams.get("videoId")?.trim() ?? "";

        if (!/^[\w-]{11}$/.test(videoId)) {
          return new Response("A valid YouTube video ID is required.", { status: 400 });
        }

        try {
          const body = await generateWaveformImage(videoId);
          return new Response(body, {
            headers: {
              "Cache-Control": "public, max-age=600, stale-while-revalidate=1800",
              "Content-Type": "image/png",
            },
          });
        } catch (error) {
          return new Response(error instanceof Error ? error.message : "Could not generate waveform.", {
            status: 502,
          });
        }
      },
    },

    "/api/youtube/waveform-data": {
      async GET(request) {
        const url = new URL(request.url);
        const videoId = url.searchParams.get("videoId")?.trim() ?? "";

        if (!/^[\w-]{11}$/.test(videoId)) {
          return new Response("A valid YouTube video ID is required.", {
            status: 400,
          });
        }

        try {
          const payload = await generateWaveformData(videoId);
          return json(payload, {
            headers: {
              "Cache-Control": "public, max-age=600, stale-while-revalidate=1800",
            },
          });
        } catch (error) {
          return new Response(
            error instanceof Error
              ? error.message
              : "Could not generate waveform data.",
            {
              status: 502,
            },
          );
        }
      },
    },

    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
