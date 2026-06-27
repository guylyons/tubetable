const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
const MAX_START_SECONDS = 24 * 60 * 60;

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
  if (!Number.isFinite(value) || value > MAX_START_SECONDS) {
    return 0;
  }

  return Math.max(0, value);
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

function startsWithMp3Data(chunk: Uint8Array) {
  const first = chunk[0];
  const second = chunk[1];
  const third = chunk[2];

  if (first === 0x49 && second === 0x44 && third === 0x33) {
    return true;
  }

  return first === 0xff && second !== undefined && (second & 0xe0) === 0xe0;
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

  if (!startsWithMp3Data(firstChunk.value)) {
    reader.releaseLock();
    const stderr = await readStreamText(process.stderr);
    throw new Error(stderr || "Audio process produced non-MP3 data.");
  }

  let abortHandler: (() => void) | null = () => {
    try {
      process.kill?.();
    } catch {
      // Ignore abort cleanup failures.
    }
  };
  request.signal.addEventListener("abort", abortHandler, { once: true });

  let readerReleased = false;
  const cleanup = () => {
    if (!readerReleased) {
      reader.releaseLock();
      readerReleased = true;
    }

    if (abortHandler) {
      request.signal.removeEventListener("abort", abortHandler);
      abortHandler = null;
    }
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(firstChunk.value);
    },
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          cleanup();
          controller.close();
          return;
        }

        controller.enqueue(result.value);
      } catch (error) {
        cleanup();
        controller.error(error);
      }
    },
    cancel() {
      try {
        process.kill?.();
      } catch {
        // Ignore stream cancellation cleanup failures.
      } finally {
        cleanup();
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
