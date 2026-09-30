import { useDeferredValue, useEffect, useMemo, useState } from "react";
import "./index.css";
import { MixControlPanel } from "./components/MixControlPanel";
import { MixHeader } from "./components/MixHeader";
import { SavedMixesPanel } from "./components/SavedMixesPanel";
import { TableSection } from "./components/TableSection";
import { buildChannelStates, createChannel, reorderChannels } from "./lib/mixChannels";
import { deleteMix, getCurrentMix, restoreMix, saveDraft, selectMix, updateMix } from "./lib/mixLibrary";
import { deriveMixName } from "./lib/mixNaming";
import { createEmptyMix, createMixId, readStoredMixState } from "./lib/mixStorage";
import { parseYouTubeVideoId } from "./lib/youtube";
import {
  DRAFT_MIX_KEY,
  MAX_CHANNELS,
  STORAGE_KEY,
  type DeletedMix,
  type MixChannel,
  type MixLibrary,
  type PersistedMix,
  type YouTubeSearchPayload,
  type YouTubeSearchResult,
} from "./types";

const THEME_STORAGE_KEY = "tubetable.theme.v1";
type ThemeMode = "light" | "dark";

function readStoredTheme(): ThemeMode {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }
  } catch {
    // Ignore storage access issues and fall back to system preference.
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(readStoredTheme);
  const [library, setLibrary] = useState<MixLibrary>(readStoredMixState);
  const [lastDeleted, setLastDeleted] = useState<DeletedMix | null>(null);
  const [restartToken, setRestartToken] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery.trim());
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isResolvingInput, setIsResolvingInput] = useState(false);

  const { currentMixKey, savedMixes } = library;
  const { channels, focusedChannelId, masterVolume, name: mixTitle, transportPlaying } = getCurrentMix(library);
  const existingVideoIds = useMemo(() => new Set(channels.map(channel => channel.video.videoId)), [channels]);
  const canAddMore = channels.length < MAX_CHANNELS;
  const generatedMixName = useMemo(() => deriveMixName(channels), [channels]);
  const isSavedMix = currentMixKey !== DRAFT_MIX_KEY;
  const channelStates = useMemo(() => buildChannelStates(channels, masterVolume), [channels, masterVolume]);
  const isDarkMode = themeMode === "dark";

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = themeMode;
    root.style.colorScheme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  }, [library]);

  useEffect(() => {
    const query = deferredQuery;
    if (!query || query.length < 2 || parseYouTubeVideoId(query)) {
      setSearchResults([]);
      setSearchSuggestions([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSearching(true);
        setSearchError(null);

        const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });

        const data = (await response.json()) as YouTubeSearchPayload & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "YouTube search is temporarily unavailable.");
        }

        setSearchResults(data.results);
        setSearchSuggestions(data.suggestions);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSearchResults([]);
        setSearchSuggestions([]);
        setSearchError(error instanceof Error ? error.message : "Unable to search YouTube right now.");
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredQuery]);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setStatusMessage(null), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  useEffect(() => {
    if (!lastDeleted) {
      return;
    }

    const timeoutId = window.setTimeout(() => setLastDeleted(null), 8000);
    return () => window.clearTimeout(timeoutId);
  }, [lastDeleted]);

  // An edit the user made, so it bumps the saved mix's date.
  function editCurrentMix(updater: (mix: PersistedMix) => PersistedMix) {
    setLibrary(current => updateMix(current, current.currentMixKey, updater, new Date().toISOString()));
  }

  // Playback and layout state that should not count as an edit.
  function setCurrentMixPlayback(updater: (mix: PersistedMix) => PersistedMix) {
    setLibrary(current => updateMix(current, current.currentMixKey, updater));
  }

  function updateChannel(channelId: string, updater: (channel: MixChannel) => MixChannel) {
    editCurrentMix(mix => ({
      ...mix,
      channels: mix.channels.map(channel => (channel.id === channelId ? updater(channel) : channel)),
    }));
  }

  function updateChannelProgress(mixKey: string, channelId: string, progressSeconds: number) {
    setLibrary(current =>
      updateMix(current, mixKey, mix => ({
        ...mix,
        channels: mix.channels.map(channel => (channel.id === channelId ? { ...channel, progressSeconds } : channel)),
      })),
    );
  }

  function resetSearchUi(clearQuery = false) {
    if (clearQuery) {
      setSearchQuery("");
    }
    setSearchResults([]);
    setSearchSuggestions([]);
    setSearchError(null);
    setAddError(null);
    setShowResults(false);
  }

  function handleSelectMix(mixKey: string) {
    setLibrary(current => selectMix(current, mixKey));
    resetSearchUi(true);
  }

  function saveCurrentMix() {
    setLibrary(current =>
      saveDraft(current, {
        id: createMixId(),
        name: mixTitle.trim() || generatedMixName,
        updatedAt: new Date().toISOString(),
      }),
    );
    setStatusMessage("Saved to your library.");
  }

  function createNewMix() {
    setLibrary(current => ({ ...current, currentMixKey: DRAFT_MIX_KEY, draft: createEmptyMix() }));
    resetSearchUi(true);
  }

  function startCurrentMixFromBeginning() {
    setCurrentMixPlayback(mix => ({
      ...mix,
      channels: mix.channels.map(channel => ({ ...channel, progressSeconds: 0 })),
    }));
    setRestartToken(currentValue => currentValue + 1);
    setStatusMessage("Restarted from the beginning.");
  }

  function handleDeleteMix(mixKey: string) {
    const index = savedMixes.findIndex(mix => mix.id === mixKey);
    if (index === -1) {
      return;
    }

    setLastDeleted({ mix: savedMixes[index]!, index, wasCurrent: mixKey === currentMixKey });
    setLibrary(current => deleteMix(current, mixKey));
  }

  function undoDelete() {
    if (!lastDeleted) {
      return;
    }

    setLibrary(current => restoreMix(current, lastDeleted));
    setLastDeleted(null);
  }

  function addResultToMix(video: YouTubeSearchResult) {
    if (!canAddMore) {
      setAddError(`You can add up to ${MAX_CHANNELS} videos at once.`);
      return;
    }

    if (existingVideoIds.has(video.videoId)) {
      setAddError("That video is already on the table.");
      return;
    }

    const nextChannel = createChannel(video);
    editCurrentMix(mix => ({
      ...mix,
      channels: [...mix.channels, nextChannel],
      focusedChannelId: mix.channels.length === 0 ? nextChannel.id : mix.focusedChannelId,
      transportPlaying: true,
    }));
    resetSearchUi(true);
  }

  async function resolveInputToVideo() {
    const query = searchQuery.trim();

    if (!query) {
      return;
    }

    const pastedVideoId = parseYouTubeVideoId(query);
    if (pastedVideoId) {
      try {
        setIsResolvingInput(true);
        setAddError(null);

        const response = await fetch(`/api/youtube/video?videoId=${encodeURIComponent(pastedVideoId)}`);
        if (!response.ok) {
          throw new Error("That YouTube link did not load. Check the URL and try again.");
        }

        const data = (await response.json()) as { result: YouTubeSearchResult };
        addResultToMix(data.result);
      } catch (error) {
        setAddError(error instanceof Error ? error.message : "Could not add that YouTube link.");
      } finally {
        setIsResolvingInput(false);
      }

      return;
    }

    if (searchResults.length > 0) {
      addResultToMix(searchResults[0]!);
      return;
    }

    setAddError("Search for a video or paste a YouTube link first.");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_36%),linear-gradient(180deg,_#020617,_#0f172a_55%,_#111827)] dark:text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <MixHeader
          addError={addError}
          canAddMore={canAddMore}
          deferredQuery={deferredQuery}
          existingVideoIds={existingVideoIds}
          isResolvingInput={isResolvingInput}
          isSearching={isSearching}
          isDarkMode={isDarkMode}
          onChangeQuery={value => {
            setSearchQuery(value);
            setShowResults(true);
            setAddError(null);
          }}
          onCloseResults={() => setShowResults(false)}
          onOpenResults={() => setShowResults(true)}
          onSelectResult={addResultToMix}
          onSelectSuggestion={suggestion => {
            setSearchQuery(suggestion);
            setShowResults(true);
            setAddError(null);
          }}
          onSubmitSearch={() => {
            void resolveInputToVideo();
          }}
          onToggleTheme={() => setThemeMode(currentMode => (currentMode === "dark" ? "light" : "dark"))}
          searchError={searchError}
          searchQuery={searchQuery}
          searchResults={searchResults}
          searchSuggestions={searchSuggestions}
          showResults={showResults}
        />

        <main className="grid flex-1 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <TableSection
            channelStates={channelStates}
            focusedChannelId={focusedChannelId}
            mixKey={currentMixKey}
            onChangeChannelVolume={(channelId, volume) => updateChannel(channelId, channel => ({ ...channel, volume }))}
            onFocusChannel={channelId =>
              setCurrentMixPlayback(mix => ({
                ...mix,
                focusedChannelId: mix.focusedChannelId === channelId ? null : channelId,
              }))
            }
            onProgress={updateChannelProgress}
            onRemoveChannel={channelId =>
              editCurrentMix(mix => ({
                ...mix,
                channels: mix.channels.filter(channel => channel.id !== channelId),
                focusedChannelId: mix.focusedChannelId === channelId ? null : mix.focusedChannelId,
              }))
            }
            onReorderChannel={(draggedChannelId, targetChannelId) =>
              editCurrentMix(mix => ({
                ...mix,
                channels: reorderChannels(mix.channels, draggedChannelId, targetChannelId),
              }))
            }
            onToggleLoop={channelId => updateChannel(channelId, channel => ({ ...channel, looped: !channel.looped }))}
            onToggleMute={channelId => updateChannel(channelId, channel => ({ ...channel, muted: !channel.muted }))}
            onTogglePause={channelId => updateChannel(channelId, channel => ({ ...channel, paused: !channel.paused }))}
            onToggleSolo={channelId => updateChannel(channelId, channel => ({ ...channel, solo: !channel.solo }))}
            onToggleTransport={() =>
              setCurrentMixPlayback(mix => ({ ...mix, transportPlaying: !mix.transportPlaying }))
            }
            restartToken={restartToken}
            transportPlaying={transportPlaying}
          />

          <aside className="space-y-6">
            <MixControlPanel
              generatedMixName={generatedMixName}
              isSavedMix={isSavedMix}
              masterVolume={masterVolume}
              mixTitle={mixTitle}
              onChangeMasterVolume={value => editCurrentMix(mix => ({ ...mix, masterVolume: value }))}
              onCreateNewMix={createNewMix}
              onResetChannelBalances={() =>
                editCurrentMix(mix => ({
                  ...mix,
                  channels: mix.channels.map(channel => ({
                    ...channel,
                    muted: false,
                    paused: false,
                    solo: false,
                    volume: 76,
                  })),
                }))
              }
              onSaveMix={saveCurrentMix}
              onSetMixTitle={value => editCurrentMix(mix => ({ ...mix, name: value }))}
              onStartFromBeginning={startCurrentMixFromBeginning}
              statusMessage={statusMessage}
            />

            <SavedMixesPanel
              currentMixKey={currentMixKey}
              lastDeleted={lastDeleted}
              onDeleteMix={handleDeleteMix}
              onSelectMix={handleSelectMix}
              onUndoDelete={undoDelete}
              savedMixes={savedMixes}
              transportPlaying={transportPlaying}
            />
          </aside>
        </main>
      </div>
    </div>
  );
}

export default App;
