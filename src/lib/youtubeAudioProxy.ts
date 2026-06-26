const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

type ResolveAudioUrlOptions = {
  forceRefresh: boolean;
};

export type ResolveAudioUrl = (videoId: string, options: ResolveAudioUrlOptions) => string;

export type SpawnAudioProcessOptions = {
  args: string[];
  audioUrl: string;
};

export type AudioProcess = {
  kill?: () => void;
  stderr: ReadableStream<Uint8Array> | null;
  stdout: ReadableStream<Uint8Array> | null;
};

export type SpawnAudioProcess = (options: SpawnAudioProcessOptions) => AudioProcess;

type YouTubeAudioResponseOptions = {
  request: Request;
  resolveAudioUrl: ResolveAudioUrl;
  spawnAudioProcess: SpawnAudioProcess;
  videoId: string;
};

function parsePitchShiftSemitones(request: Request) {
  const rawValue = new URL(request.url).searchParams.get("pitchShiftSemitones");
  if (rawValue === null) {
    return 0;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? Math.min(12, Math.max(-12, value)) : 0;
}

function parseStartSeconds(request: Request) {
  const rawValue = new URL(request.url).searchParams.get("startSeconds");
  if (rawValue === null) {
    return 0;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function buildFfmpegArgs(request: Request, audioUrl: string) {
  const pitchShiftSemitones = parsePitchShiftSemitones(request);
  const startSeconds = parseStartSeconds(request);
  const pitchShiftRatio = pitchShiftSemitones === 0 ? 1 : Math.pow(2, pitchShiftSemitones / 12);

  return [
    "ffmpeg",
    "-loglevel",
    "error",
    "-hide_banner",
    "-nostdin",
    "-user_agent",
    USER_AGENT,
    ...(startSeconds > 0 ? ["-ss", startSeconds.toFixed(2)] : []),
    "-i",
    audioUrl,
    ...(pitchShiftSemitones === 0
      ? []
      : ["-af", `asetrate=44100*${pitchShiftRatio.toFixed(6)},atempo=${(1 / pitchShiftRatio).toFixed(6)}`]),
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
  ];
}

async function readStreamText(stream: ReadableStream<Uint8Array> | null) {
  if (!stream) {
    return "";
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      text += decoder.decode(result.value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return text.trim();
}

async function createPrimedAudioStream(request: Request, process: AudioProcess) {
  if (!process.stdout) {
    throw new Error("Audio process did not provide an output stream.");
  }

  const reader = process.stdout.getReader();
  const firstChunk = await reader.read();

  if (firstChunk.done || !firstChunk.value?.byteLength) {
    reader.releaseLock();
    const stderr = await readStreamText(process.stderr);
    throw new Error(stderr || "Audio process exited before producing audio.");
  }

  let abortHandler: (() => void) | null = () => {
    try {
      process.kill?.();
    } catch {
      // Ignore abort cleanup failures.
    }
  };
  request.signal.addEventListener("abort", abortHandler, { once: true });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(firstChunk.value);

      try {
        while (true) {
          const result = await reader.read();
          if (result.done) {
            break;
          }
          controller.enqueue(result.value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
        if (abortHandler) {
          request.signal.removeEventListener("abort", abortHandler);
          abortHandler = null;
        }
      }
    },
    cancel() {
      try {
        process.kill?.();
      } catch {
        // Ignore stream cancellation cleanup failures.
      }
    },
  });
}

async function createAudioResponseAttempt(
  request: Request,
  audioUrl: string,
  spawnAudioProcess: SpawnAudioProcess,
) {
  const args = buildFfmpegArgs(request, audioUrl);
  const process = spawnAudioProcess({ args, audioUrl });
  const stream = await createPrimedAudioStream(request, process);

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "audio/mpeg",
    },
  });
}

export async function createYouTubeAudioResponse({
  request,
  resolveAudioUrl,
  spawnAudioProcess,
  videoId,
}: YouTubeAudioResponseOptions) {
  let firstError: Error | null = null;

  for (const forceRefresh of [false, true]) {
    try {
      const audioUrl = resolveAudioUrl(videoId, { forceRefresh });
      return await createAudioResponseAttempt(request, audioUrl, spawnAudioProcess);
    } catch (error) {
      firstError = error instanceof Error ? error : new Error("Could not start audio stream.");
    }
  }

  throw firstError ?? new Error("Could not start audio stream.");
}
