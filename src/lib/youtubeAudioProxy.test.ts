import { describe, expect, test } from "bun:test";
import { createYouTubeAudioResponse, type SpawnAudioProcess } from "./youtubeAudioProxy";

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

function streamFromChunks(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

describe("YouTube audio proxy", () => {
  test("does not seek into live streams when the player reports a huge wall-clock offset", async () => {
    let spawnedArgs: string[] = [];

    const response = await createYouTubeAudioResponse({
      request: new Request("http://localhost/api/youtube/audio?videoId=wgwUeNTPhvY&startSeconds=5106069"),
      resolveAudioUrl: () => "live-audio-url",
      spawnAudioProcess: ({ args }) => {
        spawnedArgs = args;

        return {
          stderr: streamFromChunks([]),
          stdout: streamFromChunks([bytes("ID3"), bytes("mp3-data")]),
        };
      },
      videoId: "wgwUeNTPhvY",
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ID3mp3-data");
    expect(spawnedArgs).not.toContain("-ss");
    expect(spawnedArgs).not.toContain("5106069.00");
  });

  test("seeks into normal video offsets", async () => {
    let spawnedArgs: string[] = [];

    const response = await createYouTubeAudioResponse({
      request: new Request("http://localhost/api/youtube/audio?videoId=Xw5AiRVqfqk&startSeconds=577"),
      resolveAudioUrl: () => "video-audio-url",
      spawnAudioProcess: ({ args }) => {
        spawnedArgs = args;

        return {
          stderr: streamFromChunks([]),
          stdout: streamFromChunks([bytes("ID3"), bytes("mp3-data")]),
        };
      },
      videoId: "Xw5AiRVqfqk",
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ID3mp3-data");
    expect(spawnedArgs).toContain("-ss");
    expect(spawnedArgs).toContain("577.00");
  });

  test("retries with a fresh audio URL instead of returning an empty 200 when ffmpeg produces no bytes", async () => {
    const resolvedUrls: string[] = [];
    const spawnedUrls: string[] = [];
    const spawnAudioProcess: SpawnAudioProcess = ({ audioUrl }) => {
      spawnedUrls.push(audioUrl);

      if (audioUrl === "stale-audio-url") {
        return {
          stderr: streamFromChunks([bytes("Server returned 403 Forbidden")]),
          stdout: streamFromChunks([]),
        };
      }

      return {
        stderr: streamFromChunks([]),
        stdout: streamFromChunks([bytes("ID3"), bytes("mp3-data")]),
      };
    };

    const response = await createYouTubeAudioResponse({
      request: new Request("http://localhost/api/youtube/audio?videoId=Xw5AiRVqfqk&startSeconds=577"),
      resolveAudioUrl: (_videoId, options) => {
        const url = options.forceRefresh ? "fresh-audio-url" : "stale-audio-url";
        resolvedUrls.push(url);
        return url;
      },
      spawnAudioProcess,
      videoId: "Xw5AiRVqfqk",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(await response.text()).toBe("ID3mp3-data");
    expect(resolvedUrls).toEqual(["stale-audio-url", "fresh-audio-url"]);
    expect(spawnedUrls).toEqual(["stale-audio-url", "fresh-audio-url"]);
  });
});
