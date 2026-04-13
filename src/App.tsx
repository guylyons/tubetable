import { useDeferredValue, useEffect, useMemo, useState } from "react";
import "./index.css";
import { MasterBusPanel } from "./components/MasterBusPanel";
import { MixerSection } from "./components/MixerSection";
import { MixControlPanel } from "./components/MixControlPanel";
import { MixHeader } from "./components/MixHeader";
import { SavedMixesPanel } from "./components/SavedMixesPanel";
import { TableSection } from "./components/TableSection";
import { deriveMixName } from "./lib/mixNaming";
import { buildChannelStates, createChannel, reorderChannels } from "./lib/mixChannels";
import { createEmptyMix, createMixId, readStoredMixState } from "./lib/mixStorage";
import { parseYouTubeVideoId } from "./lib/youtube";
import {
  DRAFT_MIX_KEY,
  MAX_CHANNELS,
  STORAGE_KEY,
  type MixChannel,
  type MixStorage,
  type PersistedMix,
  type SavedMix,
  type YouTubeSearchPayload,
  type YouTubeSearchResult,
} from "./types";

export function App() {
  const storedMixState = useMemo(() => readStoredMixState(), []);
  const [channels, setChannels] = useState<MixChannel[]>(() => storedMixState.draft.channels);
  const [masterVolume, setMasterVolume] = useState<number>(() => storedMixState.draft.masterVolume);
  const [transportPlaying, setTransportPlaying] = useState<boolean>(() => storedMixState.draft.transportPlaying);
  const [focusedChannelId, setFocusedChannelId] = useState<string | null>(() => storedMixState.draft.focusedChannelId);
  const [mixTitle, setMixTitle] = useState<string>(() => storedMixState.draft.name);
  const [currentMixKey, setCurrentMixKey] = useState<string>(() => storedMixState.currentMixKey);
  const [draftCache, setDraftCache] = useState<Record<string, PersistedMix>>(() => storedMixState.draftCache);
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>(() => storedMixState.savedMixes);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery.trim());
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isResolvingInput, setIsResolvingInput] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const existingVideoIds = useMemo(() => new Set(channels.map(channel => channel.video.videoId)), [channels]);
  const canAddMore = channels.length < MAX_CHANNELS;
  const generatedMixName = useMemo(() => deriveMixName(channels), [channels]);
  const mixName = mixTitle.trim() || generatedMixName;
  const isSavedMix = currentMixKey !== DRAFT_MIX_KEY;
  const activeDraft = useMemo(
    () =>
      ({
        name: mixTitle,
        channels,
        masterVolume,
        transportPlaying,
        focusedChannelId,
      }) satisfies PersistedMix,
    [channels, focusedChannelId, masterVolume, mixTitle, transportPlaying],
  );
  const effectiveDraftCache = useMemo(
    () => ({ ...draftCache, [currentMixKey]: activeDraft }),
    [activeDraft, currentMixKey, draftCache],
  );
  const channelStates = useMemo(() => buildChannelStates(channels, masterVolume), [channels, masterVolume]);
  const audibleChannels = channelStates.filter(channel => channel.effectiveVolume > 0).length;

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentMixKey,
        draft: activeDraft,
        draftCache: effectiveDraftCache,
        savedMixes,
      } satisfies MixStorage),
    );
  }, [activeDraft, currentMixKey, effectiveDraftCache, savedMixes]);

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

        if (!response.ok) {
          throw new Error("YouTube search is temporarily unavailable.");
        }

        const data = (await response.json()) as YouTubeSearchPayload;
        setSearchResults(data.results);
        setSearchSuggestions(data.suggestions);
        setShowResults(true);
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
    if (!saveMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setSaveMessage(null), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [saveMessage]);

  useEffect(() => {
    if (!focusedChannelId) {
      return;
    }

    if (channels.some(channel => channel.id === focusedChannelId)) {
      return;
    }

    setFocusedChannelId(channels[0]?.id ?? null);
  }, [channels, focusedChannelId]);

  function updateChannel(channelId: string, updater: (channel: MixChannel) => MixChannel) {
    setChannels(currentChannels => currentChannels.map(channel => (channel.id === channelId ? updater(channel) : channel)));
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

  function loadMix(mix: PersistedMix, mixKey: string) {
    setChannels(mix.channels);
    setMasterVolume(mix.masterVolume);
    setTransportPlaying(mix.transportPlaying);
    setFocusedChannelId(mix.focusedChannelId);
    setMixTitle(mix.name);
    setCurrentMixKey(mixKey);
    resetSearchUi(true);
  }

  function saveCurrentMix() {
    const timestamp = new Date().toISOString();
    const nextMixId = isSavedMix ? currentMixKey : createMixId();
    const mixToSave: SavedMix = {
      id: nextMixId,
      name: mixName,
      channels,
      masterVolume,
      transportPlaying,
      focusedChannelId,
      updatedAt: timestamp,
    };

    setSavedMixes(currentMixes =>
      [mixToSave, ...currentMixes.filter(existingMix => existingMix.id !== mixToSave.id)].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    );
    setDraftCache(currentCache => ({
      ...currentCache,
      [mixToSave.id]: {
        name: mixToSave.name,
        channels: mixToSave.channels,
        masterVolume: mixToSave.masterVolume,
        transportPlaying: mixToSave.transportPlaying,
        focusedChannelId: mixToSave.focusedChannelId,
      },
    }));
    setCurrentMixKey(mixToSave.id);
    setMixTitle(mixToSave.name);
    setSaveMessage(isSavedMix ? "Mix updated" : "Mix saved");
  }

  function createNewMix() {
    setDraftCache(currentCache => ({
      ...currentCache,
      [DRAFT_MIX_KEY]: createEmptyMix(""),
    }));
    loadMix(createEmptyMix(""), DRAFT_MIX_KEY);
    setSaveMessage("New mix ready");
  }

  function selectMix(targetMixKey: string) {
    const targetDraft = effectiveDraftCache[targetMixKey];
    const savedMix = savedMixes.find(mix => mix.id === targetMixKey);

    if (targetDraft) {
      loadMix(targetDraft, targetMixKey);
      setSaveMessage(targetMixKey === DRAFT_MIX_KEY ? "Draft loaded" : "Mix loaded");
      return;
    }

    if (savedMix) {
      loadMix(savedMix, savedMix.id);
      setSaveMessage("Mix loaded");
    }
  }

  function deleteMix(targetMixKey: string) {
    const deletingCurrentMix = currentMixKey === targetMixKey;

    setSavedMixes(currentMixes => currentMixes.filter(mix => mix.id !== targetMixKey));
    setDraftCache(currentCache => {
      const nextCache = { ...currentCache };
      delete nextCache[targetMixKey];

      if (deletingCurrentMix) {
        nextCache[DRAFT_MIX_KEY] = activeDraft;
      }

      return nextCache;
    });

    if (deletingCurrentMix) {
      setCurrentMixKey(DRAFT_MIX_KEY);
      setSaveMessage("Mix deleted");
      return;
    }

    setSaveMessage("Mix deleted");
  }

  function addResultToMix(video: YouTubeSearchResult) {
    if (!canAddMore) {
      setAddError(`You can mix up to ${MAX_CHANNELS} channels at once.`);
      return;
    }

    if (existingVideoIds.has(video.videoId)) {
      setAddError("That channel is already in the mix.");
      return;
    }

    const nextChannel = createChannel(video);
    setChannels(currentChannels => [...currentChannels, nextChannel]);
    setFocusedChannelId(currentFocusedChannelId => (channels.length === 0 ? nextChannel.id : currentFocusedChannelId));
    setTransportPlaying(true);
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
          throw new Error("That YouTube link could not be resolved.");
        }

        const data = (await response.json()) as { result: YouTubeSearchResult };
        addResultToMix(data.result);
      } catch (error) {
        setAddError(error instanceof Error ? error.message : "Unable to add that YouTube link.");
      } finally {
        setIsResolvingInput(false);
      }

      return;
    }

    if (searchResults.length > 0) {
      addResultToMix(searchResults[0]!);
      return;
    }

    setAddError("Search for a video title or paste a YouTube link.");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <MixHeader
          addError={addError}
          audibleChannels={audibleChannels}
          canAddMore={canAddMore}
          channelStates={channelStates}
          channelsCount={channels.length}
          deferredQuery={deferredQuery}
          existingVideoIds={existingVideoIds}
          isSavedMix={isSavedMix}
          isResolvingInput={isResolvingInput}
          isSearching={isSearching}
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
          onToggleTransport={() => setTransportPlaying(currentValue => !currentValue)}
          searchError={searchError}
          searchQuery={searchQuery}
          searchResults={searchResults}
          searchSuggestions={searchSuggestions}
          showResults={showResults}
          transportPlaying={transportPlaying}
        />

        <main className="grid flex-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <MixControlPanel
              generatedMixName={generatedMixName}
              isSavedMix={isSavedMix}
              mixTitle={mixTitle}
              onCreateNewMix={createNewMix}
              onSaveMix={saveCurrentMix}
              onSetMixTitle={setMixTitle}
              saveMessage={saveMessage}
            />

            <SavedMixesPanel
              currentMixKey={currentMixKey}
              onDeleteMix={deleteMix}
              onSelectMix={selectMix}
              savedMixes={savedMixes}
              transportPlaying={transportPlaying}
            />


            <MasterBusPanel
              masterVolume={masterVolume}
              onChangeMasterVolume={setMasterVolume}
              onClearMix={() => {
                setChannels([]);
                setFocusedChannelId(null);
                setTransportPlaying(false);
              }}
              onResetChannelBalances={() =>
                setChannels(currentChannels =>
                  currentChannels.map(channel => ({
                    ...channel,
                    muted: false,
                    paused: false,
                    solo: false,
                    volume: 76,
                  })),
                )
              }
              onToggleTransport={() => setTransportPlaying(currentValue => !currentValue)}
              transportPlaying={transportPlaying}
            />
          </aside>

          <div className="space-y-6">
            <TableSection
              channelStates={channelStates}
              focusedChannelId={focusedChannelId}
              onFocusChannel={channelId =>
                setFocusedChannelId(currentFocusedChannelId =>
                  currentFocusedChannelId === channelId ? null : channelId,
                )
              }
              onReorderChannel={(draggedChannelId, targetChannelId) =>
                setChannels(currentChannels => reorderChannels(currentChannels, draggedChannelId, targetChannelId))
              }
              onRemoveChannel={channelId =>
                setChannels(currentChannels => currentChannels.filter(item => item.id !== channelId))
              }
              onToggleLoop={channelId =>
                updateChannel(channelId, currentChannel => ({ ...currentChannel, looped: !currentChannel.looped }))
              }
              onToggleMute={channelId =>
                updateChannel(channelId, currentChannel => ({ ...currentChannel, muted: !currentChannel.muted }))
              }
              onTogglePause={channelId =>
                updateChannel(channelId, currentChannel => ({ ...currentChannel, paused: !currentChannel.paused }))
              }
              onToggleSolo={channelId =>
                updateChannel(channelId, currentChannel => ({ ...currentChannel, solo: !currentChannel.solo }))
              }
              transportPlaying={transportPlaying}
            />

            <MixerSection
              channelStates={channelStates}
              onChangeChannelVolume={(channelId, volume) =>
                updateChannel(channelId, currentChannel => ({
                  ...currentChannel,
                  volume,
                }))
              }
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
