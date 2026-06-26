export const AUDIO_DIAGNOSTICS_LIMIT = 180;

export type AudioDiagnosticData = Record<string, unknown>;

export type AudioDiagnosticEntry = {
  eventName: string;
  label: string;
  timestampMs: number;
  data: AudioDiagnosticData;
};

type AudioDiagnosticsOptions = {
  enabled: boolean;
  label?: string;
  limit?: number;
  now?: () => number;
  logger?: Pick<Console, "info">;
};

export type AudioDiagnostics = {
  readonly entries: readonly AudioDiagnosticEntry[];
  record: (eventName: string, data?: AudioDiagnosticData) => void;
};

export function createAudioDiagnostics({
  enabled,
  label = "unknown",
  limit = AUDIO_DIAGNOSTICS_LIMIT,
  now = () => performance.now(),
  logger,
}: AudioDiagnosticsOptions): AudioDiagnostics {
  const entries: AudioDiagnosticEntry[] = [];
  const normalizedLimit = Math.max(1, Math.floor(limit));

  return {
    get entries() {
      return entries;
    },

    record(eventName, data = {}) {
      if (!enabled) {
        return;
      }

      const entry = {
        eventName,
        label,
        timestampMs: Math.round(now()),
        data,
      };

      entries.push(entry);
      if (entries.length > normalizedLimit) {
        entries.splice(0, entries.length - normalizedLimit);
      }

      logger?.info("[tubetable audio diagnostics]", entry);
    },
  };
}
